/**
 * @jest-environment node
 *
 * Authorization for the account deletion lifecycle (#1406) and the scheduled
 * job endpoints.
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

// The admin guard itself (allowlist, session, brute-force throttling) is
// covered by its own tests; here only its outcome matters.
let mockAdminCookie: string | undefined;
const MOCK_ADMIN = "did:privy:admin";
jest.mock("@/lib/admin-auth", () => ({
  requireAdminSession: jest.fn(async () =>
    mockAdminCookie === MOCK_ADMIN
      ? null
      : Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
  requireAdminIdentity: jest.fn(async () =>
    mockAdminCookie === MOCK_ADMIN
      ? { admin: MOCK_ADMIN, response: null }
      : {
          admin: null,
          response: Response.json({ error: "Unauthorized" }, { status: 401 }),
        }
  ),
}));

jest.mock("@/lib/users/deletion", () => ({
  requestAccountDeletion: jest.fn(),
  cancelAccountDeletion: jest.fn(),
  setLegalHold: jest.fn(async () => true),
  resetPurgeAttempts: jest.fn(async () => true),
  listDeletions: jest.fn(async () => []),
  deletionGraceDays: () => 30,
  purgeDueDeletions: jest.fn(),
}));
jest.mock("@/lib/jobs/scheduled-job", () => ({
  runScheduledJob: jest.fn(async () => ({
    job: "job",
    runId: "run-1",
    status: "succeeded",
    startedAt: new Date().toISOString(),
    durationMs: 0,
    metrics: {},
    alerts: [],
  })),
  jobHttpStatus: () => 200,
}));
jest.mock("@/lib/mux/asset-reconciliation", () => ({
  runMuxReconciliation: jest.fn(),
}));

import {
  cancelAccountDeletion,
  requestAccountDeletion,
  setLegalHold,
} from "@/lib/users/deletion";
import { runScheduledJob } from "@/lib/jobs/scheduled-job";
import { verifySession } from "@/lib/auth/verify-session";
import * as selfService from "@/app/api/users/me/deletion/route";
import { DELETE as adminDeleteUser } from "@/app/api/admin/users/[userId]/route";
import * as adminDeletion from "@/app/api/admin/users/[userId]/deletion/route";
import { GET as listDeletionsRoute } from "@/app/api/admin/users/deletions/route";
import { GET as purgeCron } from "@/app/api/routes-f/cron-purge-deleted-users/route";
import { GET as muxCron } from "@/app/api/routes-f/cron-mux-asset-reconciliation/route";

const USER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const ADMIN = "did:privy:admin";

function request(
  url: string,
  method = "GET",
  {
    body,
    cookie,
    auth,
  }: { body?: unknown; cookie?: string; auth?: string } = {}
) {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.cookie = cookie;
  }
  if (auth) {
    headers.authorization = auth;
  }
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function sessionUser(deletedAt: string | null) {
  mockDb.on(/FROM users\s+WHERE privy_id =/, {
    rows: [
      {
        id: USER,
        privy_id: "did:privy:user",
        wallet: "GW",
        username: "alice",
        email: "a@b.io",
        deleted_at: deletedAt,
      },
    ],
  });
}

const userCookie = "privy_session=did:privy:user";
const params = (userId: string) => ({ params: Promise.resolve({ userId }) });

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  mockAdminCookie = undefined;
  process.env.ADMIN_PRIVY_IDS = ADMIN;
  process.env.CRON_SECRET = "cron-secret";
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("verifySession and tombstoned accounts", () => {
  it("rejects a tombstoned account by default", async () => {
    sessionUser("2026-09-25T00:00:00Z");
    const session = await verifySession(
      request("/x", "GET", { cookie: userCookie })
    );
    expect(session.ok).toBe(false);
    if (!session.ok) {
      expect(session.response.status).toBe(403);
      expect((await session.response.json()).code).toBe(
        "ACCOUNT_PENDING_DELETION"
      );
    }
  });

  it("lets opted-in routes through during the grace window", async () => {
    sessionUser("2026-09-25T00:00:00Z");
    const session = await verifySession(
      request("/x", "GET", { cookie: userCookie }),
      { allowPendingDeletion: true }
    );
    expect(session).toMatchObject({ ok: true, userId: USER });
  });

  it("rejects the legacy wallet cookie for tombstoned users too", async () => {
    const wallet = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
    mockDb.on(/WHERE wallet =/, {
      rows: [{ id: USER, wallet, deleted_at: "2026-09-25T00:00:00Z" }],
    });
    const session = await verifySession(
      request("/x", "GET", { cookie: `wallet=${wallet}` })
    );
    expect(session.ok).toBe(false);
  });
});

describe("self-service /api/users/me/deletion", () => {
  it("requires a session", async () => {
    const res = await selfService.POST(
      request("/api/users/me/deletion", "POST", { body: { confirm: "alice" } })
    );
    expect(res.status).toBe(401);
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("requires the username as confirmation", async () => {
    sessionUser(null);
    const res = await selfService.POST(
      request("/api/users/me/deletion", "POST", {
        cookie: userCookie,
        body: { confirm: "bob" },
      })
    );
    expect(res.status).toBe(400);
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("only ever deletes the caller's own account", async () => {
    sessionUser(null);
    (requestAccountDeletion as jest.Mock).mockResolvedValue({
      outcome: "created",
      deletion: { status: "pending", purge_after: "2026-10-25" },
    });
    const res = await selfService.POST(
      request("/api/users/me/deletion", "POST", {
        cookie: userCookie,
        body: { confirm: "Alice", userId: OTHER },
      })
    );
    expect(res.status).toBe(201);
    expect(requestAccountDeletion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, requestedByType: "self" })
    );
  });

  it("lets a tombstoned user cancel their own deletion", async () => {
    sessionUser("2026-09-25T00:00:00Z");
    (cancelAccountDeletion as jest.Mock).mockResolvedValue({
      outcome: "cancelled",
    });
    const res = await selfService.DELETE(
      request("/api/users/me/deletion", "DELETE", { cookie: userCookie })
    );
    expect(res.status).toBe(200);
    expect(cancelAccountDeletion).toHaveBeenCalledWith({
      userId: USER,
      cancelledBy: USER,
    });
  });

  it("reports a purge already in progress as 409", async () => {
    sessionUser("2026-09-25T00:00:00Z");
    (cancelAccountDeletion as jest.Mock).mockResolvedValue({
      outcome: "purge_in_progress",
    });
    const res = await selfService.DELETE(
      request("/api/users/me/deletion", "DELETE", { cookie: userCookie })
    );
    expect(res.status).toBe(409);
  });

  it("does not let a tombstoned user request deletion again or act normally", async () => {
    sessionUser("2026-09-25T00:00:00Z");
    const res = await selfService.POST(
      request("/api/users/me/deletion", "POST", {
        cookie: userCookie,
        body: { confirm: "alice" },
      })
    );
    expect(res.status).toBe(403);
  });
});

describe("admin deletion endpoints", () => {
  it("reject non-admins", async () => {
    mockAdminCookie = "did:privy:someone-else";
    expect(
      (await adminDeleteUser(request("/x", "DELETE"), params(USER))).status
    ).toBe(401);
    expect(
      (await adminDeletion.DELETE(request("/x", "DELETE"), params(USER))).status
    ).toBe(401);
    expect(
      (
        await adminDeletion.PATCH(
          request("/x", "PATCH", { body: { legalHold: true } }),
          params(USER)
        )
      ).status
    ).toBe(401);
    expect((await listDeletionsRoute(request("/x"))).status).toBe(401);
  });

  it("admin delete tombstones instead of hard-deleting", async () => {
    mockAdminCookie = ADMIN;
    (requestAccountDeletion as jest.Mock).mockResolvedValue({
      outcome: "created",
      deletion: { status: "pending", purge_after: "2026-10-25" },
    });
    const res = await adminDeleteUser(
      request(`/api/admin/users/${USER}?reason=abuse`, "DELETE"),
      params(USER)
    );
    expect(res.status).toBe(200);
    expect(requestAccountDeletion).toHaveBeenCalledWith({
      userId: USER,
      requestedByType: "admin",
      requestedBy: ADMIN,
      reason: "abuse",
    });
    expect(mockDb.callsMatching(/DELETE FROM users/)).toHaveLength(0);
  });

  it("admin cancel is attributed to the admin", async () => {
    mockAdminCookie = ADMIN;
    (cancelAccountDeletion as jest.Mock).mockResolvedValue({
      outcome: "cancelled",
    });
    const res = await adminDeletion.DELETE(
      request("/x", "DELETE"),
      params(USER)
    );
    expect(res.status).toBe(200);
    expect(cancelAccountDeletion).toHaveBeenCalledWith({
      userId: USER,
      cancelledBy: `admin:${ADMIN}`,
    });
  });

  it("validates legal hold input", async () => {
    mockAdminCookie = ADMIN;
    const bad = await adminDeletion.PATCH(
      request("/x", "PATCH", { body: { legalHold: "yes" } }),
      params(USER)
    );
    expect(bad.status).toBe(400);
    const ok = await adminDeletion.PATCH(
      request("/x", "PATCH", { body: { legalHold: true, reason: "subpoena" } }),
      params(USER)
    );
    expect(ok.status).toBe(200);
    expect(setLegalHold).toHaveBeenCalledWith({
      userId: USER,
      hold: true,
      reason: "subpoena",
    });
  });
});

describe("cron endpoints", () => {
  const crons = [
    ["purge-deleted-users", purgeCron],
    ["mux-asset-reconciliation", muxCron],
  ] as const;

  it.each(crons)("%s rejects missing or wrong credentials", async (_, cron) => {
    expect((await cron(request("/x"))).status).toBe(401);
    expect(
      (await cron(request("/x", "GET", { auth: "Bearer wrong" }))).status
    ).toBe(401);
    expect(runScheduledJob).not.toHaveBeenCalled();
  });

  it.each(crons)(
    "%s refuses to run when CRON_SECRET is unset",
    async (_, cron) => {
      delete process.env.CRON_SECRET;
      expect(
        (await cron(request("/x", "GET", { auth: "Bearer undefined" }))).status
      ).toBe(401);
    }
  );

  it.each(crons)("%s runs with the right bearer token", async (_, cron) => {
    const res = await cron(
      request("/x", "GET", { auth: "Bearer cron-secret" })
    );
    expect(res.status).toBe(200);
    expect(runScheduledJob).toHaveBeenCalledTimes(1);
  });
});
