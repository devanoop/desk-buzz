import { createServerFn } from "@tanstack/react-start";
import {
  getCookie,
  getRequestHeader,
  getRequestIP,
  getRequestUrl,
} from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import {
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from "./password";
import {
  createSessionAndSetCookie,
  clearSessionCookie,
  getSessionFromRequest,
  revokeSession,
  SESSION_COOKIE_NAME,
} from "./sessions";
import { checkRateLimit, RATE_LIMITS } from "./rate-limit";
import { requireAuth } from "./middleware";
import { getRolesForUser, grantRole } from "./roles";
import {
  createEmailVerificationToken,
  sendVerificationEmail,
  verifyEmailToken,
} from "./email-verification";
import {
  createPasswordResetToken,
  sendPasswordResetEmail,
  resetPasswordWithToken,
} from "./password-reset";
import { logger } from "../logging/logger";

// Trusts X-Forwarded-For — safe because every documented deployment target
// (Railway/Render/Fly, per docs/audit/PHASE1-ARCHITECTURE.md §9) terminates
// TLS at a single first-party proxy hop in front of this app.
function clientIp(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

function baseUrl(): string {
  return getRequestUrl().origin;
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const signup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ email: emailSchema, password: z.string().min(1).max(256) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { computeCsrfToken } = await import("./csrf.server");
    await checkRateLimit(clientIp(), "signup", RATE_LIMITS.signup);

    const policyError = validatePasswordPolicy(data.password);
    if (policyError) throw new Error(policyError);

    const db = getDb();
    const existing = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });
    if (existing) throw new Error("An account with this email already exists.");

    const passwordHash = await hashPassword(data.password);
    const [user] = await db
      .insert(users)
      .values({ email: data.email, passwordHash, passwordAlgo: "argon2id" })
      .returning({ id: users.id, email: users.email });

    await grantRole(user.id, "user");

    const verifyToken = await createEmailVerificationToken(user.id);
    await sendVerificationEmail(user.email, verifyToken, baseUrl());

    const { rawToken } = await createSessionAndSetCookie(user.id, {
      userAgent: getRequestHeader("user-agent"),
      ip: clientIp(),
    });

    logger.info("auth.signup", { userId: user.id, ip: clientIp() });

    return {
      user: { id: user.id, email: user.email, emailVerified: false },
      roles: ["user"],
      csrfToken: computeCsrfToken(rawToken),
    };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ email: emailSchema, password: z.string().min(1).max(256) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { computeCsrfToken } = await import("./csrf.server");
    await checkRateLimit(clientIp(), "login", RATE_LIMITS.login);
    await checkRateLimit(data.email, "login", RATE_LIMITS.login);

    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });
    // Same generic message whether the email doesn't exist or the password
    // is wrong — doesn't tell an attacker which part failed.
    const genericError = "Invalid email or password.";
    if (!user) {
      logger.warn("auth.login_failed", {
        reason: "no_such_user",
        ip: clientIp(),
      });
      throw new Error(genericError);
    }

    const result = await verifyPassword(
      data.password,
      user.passwordHash,
      user.passwordAlgo as "argon2id" | "bcrypt",
    );
    if (!result.valid) {
      logger.warn("auth.login_failed", {
        reason: "bad_password",
        userId: user.id,
        ip: clientIp(),
      });
      throw new Error(genericError);
    }

    if (result.needsRehash) {
      const upgraded = await hashPassword(data.password);
      await db
        .update(users)
        .set({ passwordHash: upgraded, passwordAlgo: "argon2id" })
        .where(eq(users.id, user.id));
    }

    const roles = await getRolesForUser(user.id);
    const { rawToken } = await createSessionAndSetCookie(user.id, {
      userAgent: getRequestHeader("user-agent"),
      ip: clientIp(),
    });

    logger.info("auth.login_succeeded", { userId: user.id, ip: clientIp() });

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: !!user.emailVerifiedAt,
      },
      roles,
      csrfToken: computeCsrfToken(rawToken),
    };
  });

export const logout = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await revokeSession(context.sessionId);
    clearSessionCookie();
    logger.info("auth.logout", { userId: context.userId });
    return { ok: true };
  });

/** Used to hydrate client-side auth state on page load — returns null rather than throwing when signed out. */
export const me = createServerFn({ method: "GET" }).handler(async () => {
  const { computeCsrfToken } = await import("./csrf.server");
  const result = await getSessionFromRequest();
  if (!result) return null;
  const rawToken = getCookie(SESSION_COOKIE_NAME)!;
  const roles = await getRolesForUser(result.user.id);
  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      emailVerified: !!result.user.emailVerifiedAt,
    },
    roles,
    csrfToken: computeCsrfToken(rawToken),
  };
});

export const requestEmailVerification = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.user.emailVerifiedAt)
      return { ok: true, alreadyVerified: true };
    const token = await createEmailVerificationToken(context.userId);
    await sendVerificationEmail(context.user.email, token, baseUrl());
    return { ok: true, alreadyVerified: false };
  });

export const confirmEmailVerification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const result = await verifyEmailToken(data.token);
    if (!result.ok) throw new Error(result.error);
    return { ok: true };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ email: emailSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    await checkRateLimit(
      clientIp(),
      "password-reset-request",
      RATE_LIMITS.passwordResetRequest,
    );

    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });
    // Always return the same response whether or not the account exists —
    // otherwise this endpoint becomes an email-enumeration oracle.
    if (user) {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(user.email, token, baseUrl());
    }
    return { ok: true };
  });

export const confirmPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
        newPassword: z.string().min(1).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const result = await resetPasswordWithToken(data.token, data.newPassword);
    if (!result.ok) throw new Error(result.error);
    return { ok: true };
  });
