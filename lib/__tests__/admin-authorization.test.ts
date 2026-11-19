/** @jest-environment node */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/security/admin-auth-throttle", () => ({
  guardAdminAttempt: jest.fn(async (_attempt, verify) =>
    (await verify()) ? { ok: true } : { ok: false, reason: "denied" }
  ),
  adminGuardResponse: jest.requireActual("@/lib/security/admin-auth-throttle")
    .adminGuardResponse,
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { guardAdminAttempt } from "@/lib/security/admin-auth-throttle";
import { authorizeAdmin } from "@/lib/admin-auth";

const request = (cookie = "wallet_session=signed") =>
  new NextRequest("http://localhost/api/admin/me", { headers: { cookie } });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(verifySession).mockResolvedValue({
    ok: true,
    userId: "db-user",
    privyId: null,
    wallet: "Gwallet",
    username: "admin",
    email: null,
  });
  (sql as unknown as jest.Mock).mockResolvedValue({
    rows: [{ role: "super_admin" }],
  });
});

it.each(["wallet_session=signed", "privy_session=did:privy:verified"])(
  "uses the same database identity and policy for %s",
  async cookie => {
    expect(await authorizeAdmin(request(cookie), "admin/users")).toEqual({
      ok: true,
      admin: { userId: "db-user", privyId: null, role: "super_admin" },
      response: null,
    });
    expect((sql as unknown as jest.Mock).mock.calls[0]).toContain("db-user");
  }
);

it.each(["", "wallet=unsigned-address"])(
  "rejects missing or unsigned credentials: %s",
  async cookie => {
    expect((await authorizeAdmin(request(cookie), "admin/users")).ok).toBe(
      false
    );
    expect(verifySession).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  }
);

it.each([
  ["support", "admin/reports/stream", true],
  ["support", "admin/users", false],
  ["moderator", "routes-f/admin-user-suspend", true],
  ["moderator", "admin/roles", false],
  ["support", "tips/refresh-total", true],
  ["user", "admin/me", false],
  [null, "admin/users", false],
])("preserves permission policy: %s on %s", async (role, route, allowed) => {
  (sql as unknown as jest.Mock).mockResolvedValue({
    rows: role ? [{ role }] : [],
  });
  expect((await authorizeAdmin(request(), route)).ok).toBe(allowed);
});

it("propagates revoked/expired session denial without querying roles", async () => {
  jest.mocked(verifySession).mockResolvedValue({
    ok: false,
    response: Response.json({ error: "revoked" }, { status: 401 }) as never,
  });
  const result = await authorizeAdmin(request(), "admin/users");
  expect(result.response?.status).toBe(401);
  expect(sql).not.toHaveBeenCalled();
});

it.each([
  [{ ok: false, reason: "throttled", retryAfterSeconds: 30 }, 429],
  [{ ok: false, reason: "unavailable" }, 503],
] as const)(
  "preserves throttle failures before session verification",
  async (failure, status) => {
    jest.mocked(guardAdminAttempt).mockResolvedValueOnce(failure);
    expect(
      (await authorizeAdmin(request(), "admin/users")).response?.status
    ).toBe(status);
    expect(verifySession).not.toHaveBeenCalled();
  }
);
