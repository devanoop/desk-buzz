import { hash, verify } from "@node-rs/argon2";
import bcrypt from "bcryptjs";

// OWASP-recommended minimum for argon2id at default cost (2024 guidance).
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 256; // guards against DoS via absurdly long inputs to the KDF

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: 2, // argon2id — resistant to both GPU-cracking and side-channel attacks, OWASP's current default recommendation
    memoryCost: 19456, // 19 MiB, OWASP's minimum recommended for argon2id
    timeCost: 2,
    parallelism: 1,
  });
}

export type PasswordAlgo = "argon2id" | "bcrypt";

export interface PasswordVerifyResult {
  valid: boolean;
  /** True when a legacy bcrypt hash verified successfully and should be
   * upgraded to argon2id now that we have the plaintext in hand. */
  needsRehash: boolean;
}

/**
 * Verifies a password against either algorithm so accounts migrated from a
 * legacy bcrypt-based system (see docs/audit/PHASE1-ARCHITECTURE.md §7)
 * keep working without a forced reset. The caller is responsible for
 * calling hashPassword() and updating the stored hash/algo when
 * needsRehash is true — this function only verifies, it never re-hashes
 * itself, so it stays a pure verification step with no DB access.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  algo: PasswordAlgo,
): Promise<PasswordVerifyResult> {
  if (algo === "bcrypt") {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: valid };
  }
  const valid = await verify(storedHash, password);
  return { valid, needsRehash: false };
}
