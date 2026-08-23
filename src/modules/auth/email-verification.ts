import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { emailVerificationTokens, users } from "../db/schema";
import { generateToken, hashToken } from "./tokens";
import { getEmailSender } from "./email";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function createEmailVerificationToken(
  userId: string,
): Promise<string> {
  const db = getDb();
  const rawToken = generateToken();
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return rawToken;
}

export async function sendVerificationEmail(
  email: string,
  rawToken: string,
  baseUrl: string,
): Promise<void> {
  const url = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  await getEmailSender().send({
    to: email,
    subject: "Verify your email — DeskBuz",
    text: `Confirm your email address to finish creating your account:\n\n${url}\n\nThis link expires in 24 hours. If you didn't create a DeskBuz account, you can ignore this email.`,
  });
}

export type VerifyEmailResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function verifyEmailToken(
  rawToken: string,
): Promise<VerifyEmailResult> {
  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const row = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, tokenHash),
  });
  if (!row)
    return { ok: false, error: "Invalid or expired verification link." };
  if (row.usedAt)
    return {
      ok: false,
      error: "This verification link has already been used.",
    };
  if (row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This verification link has expired. Request a new one.",
    };
  }

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, row.id));
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, row.userId));
  return { ok: true, userId: row.userId };
}
