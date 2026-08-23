import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticateRequest,
  authorizeRoles,
  UnauthorizedError,
  ForbiddenError,
} from "../middleware";
import { computeCsrfToken, verifyCsrfToken } from "../csrf.server";
import type { AppRole } from "../roles";
import type { AuthenticatedUser } from "../sessions";

beforeAll(() => {
  process.env.CSRF_SECRET = "test-secret-do-not-use-in-production";
});

const fakeUser: AuthenticatedUser = {
  id: "user-1",
  email: "a@example.com",
  emailVerifiedAt: new Date(),
};

function fakeGetSession(
  result: { user: AuthenticatedUser; sessionId: string } | null,
) {
  return async () => result;
}

// ---------------------------------------------------------------------------
// Auth boundary: is a request authenticated at all, and (for mutations) does
// it carry a valid CSRF token?
// ---------------------------------------------------------------------------
describe("authenticateRequest — auth boundary", () => {
  it("rejects a request with no session", async () => {
    await expect(
      authenticateRequest({
        getSession: fakeGetSession(null),
        verifyCsrf: verifyCsrfToken,
        method: "GET",
        sessionCookie: undefined,
        csrfHeader: undefined,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("accepts a GET request with a valid session and no CSRF header", async () => {
    const ctx = await authenticateRequest({
      getSession: fakeGetSession({ user: fakeUser, sessionId: "sess-1" }),
      verifyCsrf: verifyCsrfToken,
      method: "GET",
      sessionCookie: "raw-session-token",
      csrfHeader: undefined,
    });
    expect(ctx.userId).toBe("user-1");
  });

  it("rejects a POST request with a valid session but no CSRF header", async () => {
    await expect(
      authenticateRequest({
        getSession: fakeGetSession({ user: fakeUser, sessionId: "sess-1" }),
        verifyCsrf: verifyCsrfToken,
        method: "POST",
        sessionCookie: "raw-session-token",
        csrfHeader: undefined,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a POST request with a CSRF token computed for a different session", async () => {
    const wrongToken = computeCsrfToken("some-other-session-token");
    await expect(
      authenticateRequest({
        getSession: fakeGetSession({ user: fakeUser, sessionId: "sess-1" }),
        verifyCsrf: verifyCsrfToken,
        method: "POST",
        sessionCookie: "raw-session-token",
        csrfHeader: wrongToken,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("accepts a POST request with the correct CSRF token for the session", async () => {
    const correctToken = computeCsrfToken("raw-session-token");
    const ctx = await authenticateRequest({
      getSession: fakeGetSession({ user: fakeUser, sessionId: "sess-1" }),
      verifyCsrf: verifyCsrfToken,
      method: "POST",
      sessionCookie: "raw-session-token",
      csrfHeader: correctToken,
    });
    expect(ctx.userId).toBe("user-1");
    expect(ctx.sessionId).toBe("sess-1");
  });

  it("does not require CSRF for HEAD requests either", async () => {
    const ctx = await authenticateRequest({
      getSession: fakeGetSession({ user: fakeUser, sessionId: "sess-1" }),
      verifyCsrf: verifyCsrfToken,
      method: "HEAD",
      sessionCookie: "raw-session-token",
      csrfHeader: undefined,
    });
    expect(ctx.userId).toBe("user-1");
  });
});

// ---------------------------------------------------------------------------
// Authz matrix: for every (role, protected action) pair, is access allowed
// or denied as the brief specifies?
//   anonymous  — read-only (no server-function call at all; nothing to test
//                here beyond "no session" above)
//   user       — own content only; never admin/moderator actions
//   moderator  — approve/reject/redact *cannot author content*
//   admin      — everything
// ---------------------------------------------------------------------------
function fakeGetRoles(roles: AppRole[]) {
  return async () => roles;
}

describe("authorizeRoles — authz matrix", () => {
  const cases: Array<{
    role: AppRole[];
    allowed: readonly AppRole[];
    shouldPass: boolean;
    label: string;
  }> = [
    {
      role: [],
      allowed: ["admin"],
      shouldPass: false,
      label: "plain user -> admin-only action",
    },
    {
      role: ["user"],
      allowed: ["admin"],
      shouldPass: false,
      label: "user role -> admin-only action",
    },
    {
      role: ["moderator"],
      allowed: ["admin"],
      shouldPass: false,
      label: "moderator -> admin-only action",
    },
    {
      role: ["admin"],
      allowed: ["admin"],
      shouldPass: true,
      label: "admin -> admin-only action",
    },
    {
      role: ["user"],
      allowed: ["moderator", "admin"],
      shouldPass: false,
      label: "user -> moderator-or-admin action",
    },
    {
      role: ["moderator"],
      allowed: ["moderator", "admin"],
      shouldPass: true,
      label: "moderator -> moderator-or-admin action",
    },
    {
      role: ["admin"],
      allowed: ["moderator", "admin"],
      shouldPass: true,
      label: "admin -> moderator-or-admin action",
    },
    {
      role: ["admin", "user"],
      allowed: ["admin"],
      shouldPass: true,
      label: "user holding multiple roles including admin -> admin-only action",
    },
  ];

  for (const { role, allowed, shouldPass, label } of cases) {
    it(`${label} — ${shouldPass ? "allowed" : "denied"}`, async () => {
      const promise = authorizeRoles({
        getRoles: fakeGetRoles(role),
        userId: "user-1",
        allowedRoles: allowed,
      });
      if (shouldPass) {
        await expect(promise).resolves.toEqual(role);
      } else {
        await expect(promise).rejects.toBeInstanceOf(ForbiddenError);
      }
    });
  }

  it("moderators can never satisfy an admin-only check, however constructed (cannot author admin-on-behalf content)", async () => {
    // Direct check on the guardrail's premise: submitReviewAdminOnBehalf and
    // redactReview both require requireAdmin, not requireModeratorOrAdmin —
    // a moderator role alone must never pass an admin-only gate.
    await expect(
      authorizeRoles({
        getRoles: fakeGetRoles(["moderator"]),
        userId: "user-1",
        allowedRoles: ["admin"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
