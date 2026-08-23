import { createMiddleware } from "@tanstack/react-start";
import {
  getCookie,
  getRequest,
  getRequestHeader,
} from "@tanstack/react-start/server";
import {
  getSessionFromRequest,
  SESSION_COOKIE_NAME,
  type AuthenticatedUser,
} from "./sessions";
import { CSRF_HEADER_NAME } from "./csrf-constants";
import { getRolesForUser, type AppRole } from "./roles";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: please sign in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden: you don't have access to this.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface AuthContext {
  userId: string;
  user: AuthenticatedUser;
  sessionId: string;
}

/**
 * The actual auth+CSRF decision logic, factored out of the TanStack
 * middleware wrapper below so it's directly unit-testable (createMiddleware
 * handlers can only really be exercised inside a live request, since they
 * read h3's request-scoped cookie/header context — this function takes
 * that context as parameters instead, so tests can supply it directly).
 */
export async function authenticateRequest(input: {
  getSession: typeof getSessionFromRequest;
  // Injected rather than statically imported from csrf.server.ts — that
  // file uses node:crypto and must only ever be reached via dynamic
  // import (see requireAuth below), matching this codebase's established
  // *.server.ts convention (e.g. integrations/supabase/client.server.ts).
  // Passing it in as a parameter also makes this function directly
  // testable with a fake, no bundler involved.
  verifyCsrf: (
    sessionRawToken: string,
    submitted: string | undefined | null,
  ) => boolean;
  method: string;
  sessionCookie: string | undefined;
  csrfHeader: string | undefined;
}): Promise<AuthContext> {
  const result = await input.getSession();
  if (!result) throw new UnauthorizedError();

  if (input.method !== "GET" && input.method !== "HEAD") {
    if (
      !input.sessionCookie ||
      !input.verifyCsrf(input.sessionCookie, input.csrfHeader)
    ) {
      throw new ForbiddenError("Forbidden: invalid or missing CSRF token.");
    }
  }

  return {
    userId: result.user.id,
    user: result.user,
    sessionId: result.sessionId,
  };
}

/**
 * The role-check decision logic, factored out the same way — see
 * authenticateRequest's doc comment.
 */
export async function authorizeRoles(input: {
  getRoles: typeof getRolesForUser;
  userId: string;
  allowedRoles: readonly AppRole[];
}): Promise<AppRole[]> {
  const roles = await input.getRoles(input.userId);
  if (!input.allowedRoles.some((r) => roles.includes(r))) {
    throw new ForbiddenError();
  }
  return roles;
}

/**
 * Requires a valid session cookie. Also enforces CSRF on every non-GET
 * request that reaches it — the session cookie is httpOnly and SameSite=Lax
 * (sent automatically by the browser even cross-site for top-level
 * navigations), so the CSRF header is what actually proves the request
 * originated from this app's own client code, not a forged cross-site form.
 */
export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { verifyCsrfToken } = await import("./csrf.server");
    const context = await authenticateRequest({
      getSession: getSessionFromRequest,
      verifyCsrf: verifyCsrfToken,
      method: getRequest().method,
      sessionCookie: getCookie(SESSION_COOKIE_NAME),
      csrfHeader: getRequestHeader(CSRF_HEADER_NAME as never),
    });
    return next({ context });
  },
);

/** Chain after requireAuth — narrows to accounts that have completed email verification. */
export const requireVerifiedEmail = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    if (!context.user.emailVerifiedAt) {
      throw new Error("Please verify your email address before doing this.");
    }
    return next();
  });

/** Chain after requireAuth — throws unless the caller holds `role`. */
export function requireRole(role: AppRole) {
  return createMiddleware({ type: "function" })
    .middleware([requireAuth])
    .server(async ({ next, context }) => {
      const roles = await authorizeRoles({
        getRoles: getRolesForUser,
        userId: context.userId,
        allowedRoles: [role],
      });
      return next({ context: { roles } });
    });
}

export const requireAdmin = requireRole("admin");
export const requireModerator = requireRole("moderator");
/** Either a moderator or an admin — used by moderation-queue actions both roles can perform. */
export const requireModeratorOrAdmin = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    const roles = await authorizeRoles({
      getRoles: getRolesForUser,
      userId: context.userId,
      allowedRoles: ["moderator", "admin"],
    });
    return next({ context: { roles } });
  });
