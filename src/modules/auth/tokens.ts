import { randomBytes, createHash } from "node:crypto";

/**
 * Shared pattern for every bearer secret this app hands to a client
 * (session cookie, email verification link, password reset link): generate
 * a random opaque token, give the raw value to the client, store only its
 * SHA-256 hash server-side. A stolen database dump alone can't be used to
 * forge a valid session or reset link — same principle as password hashing.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
