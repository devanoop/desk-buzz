import { eq } from "drizzle-orm";
import {
  getCookie,
  setCookie,
  deleteCookie,
} from "@tanstack/react-start/server";
import { getDb } from "../db/client";
import { sessions, users } from "../db/schema";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE_NAME = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
// Sliding expiry: a session used while less than this much time remains
// gets its expiry pushed back out to a full SESSION_TTL_SECONDS again,
// rather than requiring a fresh login every 30 days of continuous use.
const REFRESH_THRESHOLD_SECONDS = 60 * 60 * 24 * 7;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ rawToken: string; expiresAt: Date }> {
  const db = getDb();
  const rawToken = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });
  return { rawToken, expiresAt };
}

/** Creates a session and writes the Set-Cookie header for the current request in one step. */
export async function createSessionAndSetCookie(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ rawToken: string }> {
  const { rawToken, expiresAt } = await createSession(userId, meta);
  setCookie(SESSION_COOKIE_NAME, rawToken, cookieOptions(expiresAt));
  return { rawToken };
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
}

export async function validateSessionToken(
  rawToken: string,
): Promise<{ user: AuthenticatedUser; sessionId: string } | null> {
  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, tokenHash),
  });
  if (!row) return null;

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.id));
    return null;
  }

  if (row.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_SECONDS * 1000) {
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await db
      .update(sessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(sessions.id, row.id));
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
  });
  if (!user) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    sessionId: row.id,
  };
}

/** Reads the session cookie from the current request and validates it. Returns null if absent/invalid — never throws. */
export async function getSessionFromRequest(): Promise<{
  user: AuthenticatedUser;
  sessionId: string;
} | null> {
  const rawToken = getCookie(SESSION_COOKIE_NAME);
  if (!rawToken) return null;
  return validateSessionToken(rawToken);
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
}
