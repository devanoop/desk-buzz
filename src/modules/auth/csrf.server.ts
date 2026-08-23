import { createHmac, timingSafeEqual } from "node:crypto";

export { CSRF_HEADER_NAME } from "./csrf-constants";

function getSecret(): string {
  const secret = process.env.CSRF_SECRET;
  if (!secret) {
    throw new Error(
      "Missing CSRF_SECRET environment variable. Set it to a long random string (e.g. `openssl rand -hex 32`).",
    );
  }
  return secret;
}

/**
 * Double-submit pattern without a second cookie: the CSRF token is an HMAC
 * of the session's own (already-secret) raw token, computed server-side and
 * handed to the client once at login (in the JSON response body, not a
 * cookie — the client keeps it in memory and echoes it back as a header on
 * every mutating request). A cross-site attacker can make the browser send
 * the httpOnly session cookie automatically, but has no way to read or
 * guess the HMAC output, so they can't produce a valid header value.
 */
export function computeCsrfToken(sessionRawToken: string): string {
  return createHmac("sha256", getSecret())
    .update(sessionRawToken)
    .digest("hex");
}

export function verifyCsrfToken(
  sessionRawToken: string,
  submittedToken: string | undefined | null,
): boolean {
  if (!submittedToken) return false;
  const expected = Buffer.from(computeCsrfToken(sessionRawToken));
  const actual = Buffer.from(submittedToken);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
