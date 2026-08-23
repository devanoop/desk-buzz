import { describe, it, expect, beforeAll } from "vitest";
import { computeCsrfToken, verifyCsrfToken } from "../csrf.server";

beforeAll(() => {
  process.env.CSRF_SECRET = "test-secret-do-not-use-in-production";
});

describe("computeCsrfToken", () => {
  it("is deterministic for the same session token", () => {
    expect(computeCsrfToken("session-abc")).toBe(
      computeCsrfToken("session-abc"),
    );
  });

  it("differs for different session tokens", () => {
    expect(computeCsrfToken("session-abc")).not.toBe(
      computeCsrfToken("session-xyz"),
    );
  });

  it("throws if CSRF_SECRET is not configured", () => {
    const original = process.env.CSRF_SECRET;
    delete process.env.CSRF_SECRET;
    expect(() => computeCsrfToken("session-abc")).toThrow(/CSRF_SECRET/);
    process.env.CSRF_SECRET = original;
  });
});

describe("verifyCsrfToken", () => {
  it("accepts the correct token for the session", () => {
    const token = computeCsrfToken("session-abc");
    expect(verifyCsrfToken("session-abc", token)).toBe(true);
  });

  it("rejects a token computed for a different session", () => {
    const token = computeCsrfToken("session-abc");
    expect(verifyCsrfToken("session-other", token)).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(verifyCsrfToken("session-abc", undefined)).toBe(false);
    expect(verifyCsrfToken("session-abc", null)).toBe(false);
  });

  it("rejects a garbage/tampered token without throwing", () => {
    expect(verifyCsrfToken("session-abc", "not-a-real-token")).toBe(false);
    expect(verifyCsrfToken("session-abc", "")).toBe(false);
  });
});
