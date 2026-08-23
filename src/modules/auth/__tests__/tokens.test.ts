import { describe, it, expect } from "vitest";
import { generateToken, hashToken } from "../tokens";

describe("generateToken", () => {
  it("produces distinct tokens across calls", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });

  it("produces a URL-safe string (no characters that need escaping in a link)", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("differs for different tokens", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("never contains the original token as a substring", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });
});
