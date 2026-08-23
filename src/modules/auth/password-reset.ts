import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { passwordResetTokens, users } from "../db/schema";
import { generateToken, hashToken } from "./tokens";
import { getEmailSender } from "./email";
import { hashPassword, validatePasswordPolicy } from "./password";
import { revokeAllSessionsForUser } from "./sessions";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — shorter-lived than email verification, since a leaked reset link grants account takeover

export async function createPasswordResetToken(
  userId: string,
): Promise<string> {
  const db = getDb();
  const rawToken = generateToken();
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return rawToken;
}

export async function sendPasswordResetEmail(
  email: string,
  rawToken: string,
  baseUrl: string,
): Promise<void> {
  const url = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  await getEmailSender().send({
    to: email,
    subject: "Reset your password — DeskBuz",
    text: `Someone requested a password reset for this account. If this was you:\n\n${url}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email — your password will not be changed.`,
  });
}

export type ResetPasswordResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) return { ok: false, error: policyError };

  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const row = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });
  if (!row) return { ok: false, error: "Invalid or expired reset link." };
  if (row.usedAt)
    return { ok: false, error: "This reset link has already been used." };
  if (row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This reset link has expired. Request a new one.",
    };
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, row.id));
  await db
    .update(users)
    .set({ passwordHash, passwordAlgo: "argon2id" })
    .where(eq(users.id, row.userId));
  // A password reset is a strong signal the account may have been
  // compromised — kill every existing session, including on other devices,
  // rather than leaving them valid.
  await revokeAllSessionsForUser(row.userId);

  return { ok: true };
}
