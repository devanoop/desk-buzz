import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  MIN_PASSWORD_LENGTH,
} from "../password";
import bcrypt from "bcryptjs";

describe("validatePasswordPolicy", () => {
  it("rejects passwords shorter than the minimum", () => {
    expect(validatePasswordPolicy("short")).not.toBeNull();
  });

  it("accepts a password at exactly the minimum length", () => {
    expect(validatePasswordPolicy("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("rejects an absurdly long password (DoS guard on the KDF)", () => {
    expect(validatePasswordPolicy("a".repeat(1000))).not.toBeNull();
  });
});

describe("hashPassword / verifyPassword (argon2id)", () => {
  it("produces a hash that verifies against the original password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const result = await verifyPassword(
      "correct horse battery staple",
      hash,
      "argon2id",
    );
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(false);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const result = await verifyPassword("wrong password", hash, "argon2id");
    expect(result.valid).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });

  it("never stores the plaintext password in the hash output", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
  });
});

describe("verifyPassword (legacy bcrypt migration path)", () => {
  it("verifies a legacy bcrypt hash and flags it for rehashing", async () => {
    const legacyHash = await bcrypt.hash("legacy password", 10);
    const result = await verifyPassword(
      "legacy password",
      legacyHash,
      "bcrypt",
    );
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(true);
  });

  it("rejects an incorrect password against a legacy bcrypt hash", async () => {
    const legacyHash = await bcrypt.hash("legacy password", 10);
    const result = await verifyPassword("wrong password", legacyHash, "bcrypt");
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });
});
