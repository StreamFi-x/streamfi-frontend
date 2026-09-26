/**
 * @jest-environment node
 */
const mockReplicaSql = jest.fn();

// `.query(text, params)` records into the same mock as the tagged template,
// with the SQL text as a plain string, so one set of helpers covers both.
jest.mock("@vercel/postgres", () => {
  const sql = jest.fn();
  return {
    sql: Object.assign(sql, {
      query: (text: string, params: unknown[] = []) => sql(text, ...params),
    }),
    createPool: jest.fn(() => ({
      sql: mockReplicaSql,
      query: (text: string, params: unknown[] = []) =>
        mockReplicaSql(text, ...params),
    })),
  };
});
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/admin-auth", () => ({
  verifyAdminSession: jest.fn(),
  requireAdminSession: jest.fn(),
  currentAdminPrivyId: jest.fn().mockResolvedValue("did:privy:admin"),
  isAdmin: jest.fn().mockReturnValue(false),
  adminUnauthorized: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
jest.mock("@/lib/stellar/horizon", () => ({
  fetchPaymentsReceived: jest
    .fn()
    .mockResolvedValue({ tips: [], nextCursor: undefined }),
}));
jest.mock("@/lib/stellar/payments", () => ({
  buildTipTransaction: jest.fn().mockResolvedValue({
    hash: () => Buffer.from("ab".repeat(16), "hex"),
  }),
  submitTransaction: jest
    .fn()
    .mockResolvedValue({ success: true, hash: "txhash", ledger: 7 }),
  getCurrentNetwork: () => "testnet",
}));
jest.mock("@/lib/tracing/db-tracer", () => ({
  addTraceComment: (q: string) => q,
  logDbQuery: jest.fn(),
}));
jest.mock("@/lib/mux/server", () => ({
  getMuxStreamHealth: jest.fn().mockResolvedValue({ status: "active" }),
  deleteMuxStream: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/notifications", () => ({
  writeNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/routes-f/schedule", () => ({
  syncScheduleLiveStatusForCreator: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/routes-f/price", () => ({
  getXlmUsdPrice: jest.fn().mockResolvedValue(0.1),
}));
jest.mock("@/app/api/routes-f/activity/_lib/insert", () => ({
  insertActivityEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/stellar/config", () => ({
  getStellarNetwork: () => "testnet",
  getHorizonUrl: () => "https://horizon-testnet.example",
}));
jest.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      transactions: () => ({
        transaction: () => ({
          call: async () => ({
            successful: true,
            hash: "a".repeat(64),
            ledger_attr: 42,
            source_account: "GSENDER",
            created_at: "2026-09-01T00:00:00Z",
            operations: async () => ({
              records: [{ type: "payment", to: "GDEST", amount: "10.0000000" }],
            }),
          }),
        }),
      }),
    })),
  },
}));

import { signToken } from "@/lib/auth/sign-token";
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { requireAdminSession, verifyAdminSession } from "@/lib/admin-auth";
import { resetAppCacheForTests } from "@/lib/cache";
import { RECENT_WRITE_COOKIE, resetReplicaRouter } from "@/lib/db/replica";

import { GET as adminAnalytics } from "@/app/api/admin/analytics/route";
import { GET as dailyFollowers } from "@/app/api/routes-f/analytics-daily-followers/route";
import { GET as dailyViewers } from "@/app/api/routes-f/analytics-daily-viewers/route";
import { GET as dailyStreamMinutes } from "@/app/api/routes-f/analytics-daily-stream-minutes/route";
import {
  GET as dailyRevenue,
  POST as recordRevenue,
} from "@/app/api/routes-f/analytics-daily-revenue/route";
import { GET as topClips } from "@/app/api/routes-f/analytics-top-clips/route";
import { GET as topTippers } from "@/app/api/routes-f/analytics-top-tippers/route";
import { GET as viewerGeo } from "@/app/api/routes-f/analytics-viewer-geo/route";
import { GET as sessionList } from "@/app/api/routes-f/analytics-session-list/route";
import { GET as sessionDetail } from "@/app/api/routes-f/analytics-session-detail/route";
import { GET as creatorAnalytics } from "@/app/api/routes-f/creator/analytics/route";
import { GET as donationsHistory } from "@/app/api/routes-f/donations/history/route";
import { POST as tipsSend } from "@/app/api/tips/send/route";
import { POST as tipConfirm } from "@/app/api/routes-f/tip-confirm/route";
import {
  POST as streamStart,
  DELETE as streamStop,
} from "@/app/api/streams/start/route";
import { DELETE as streamDelete } from "@/app/api/streams/delete/route";

const mockPrimarySql = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const verifyAdminMock = verifyAdminSession as jest.Mock;
const requireAdminMock = requireAdminSession as jest.Mock;

const CHANNEL = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_UUID = "660e8400-e29b-41d4-a716-446655440001";
const REPLICA_URL = "postgres://user:pw@replica-pooler.example/db";
const ORIGINAL_ENV = process.env;

const ROW = {
  id: CHANNEL,
  count: 1,
  tip_id: OTHER_UUID,
  creator_id: CHANNEL,
  tipper_id: null,
  amount: "1",
  is_anonymous: false,
  created_at: "2026-09-01T00:00:00.000Z",
};

type Strings = TemplateStringsArray | string;
const textOf = (s: Strings) => (typeof s === "string" ? s : s.join("?"));
const isLagProbe = (s: Strings) =>
  textOf(s).includes("pg_last_xact_replay_timestamp");
const isDdl = (s: Strings) => /CREATE (TABLE|INDEX)/.test(textOf(s));
const reads = (mock: jest.Mock) =>
  mock.mock.calls.filter(([s]) => !isLagProbe(s) && !isDdl(s));
const ddl = (mock: jest.Mock) => mock.mock.calls.filter(([s]) => isDdl(s));

const SESSION_SECRET = "SENTINEL-session-secret-for-tests";

function setEnv(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET, ...env };
  resetReplicaRouter();
}

function replicaWithLag(lag: number) {
  mockReplicaSql.mockImplementation((s: Strings) =>
    Promise.resolve(
      isLagProbe(s) ? { rows: [{ lag_seconds: lag }] } : { rows: [ROW] }
    )
  );
}

function req(path: string, cookie?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new NextRequest(`http://localhost${path}`, {
    ...init,
    headers,
  } as never);
}

interface ReadCase {
  name: string;
  ddl?: boolean;
  /** False when a shared server-side cache makes per-user RYOW moot. */
  readYourWrites?: boolean;
  call: (cookie?: string) => Promise<Response>;
}

const readCases: ReadCase[] = [
  {
    // Shared by every admin through a 30s server-side cache, so it tolerates
    // staleness by design and has no read-your-own-writes path.
    name: "admin/analytics",
    readYourWrites: false,
    call: () => adminAnalytics(),
  },
  {
    name: "analytics-daily-followers",
    ddl: true,
    call: c =>
      dailyFollowers(
        req(`/api/routes-f/analytics-daily-followers?channel=${CHANNEL}`, c)
      ),
  },
  {
    name: "analytics-daily-viewers",
    ddl: true,
    call: c =>
      dailyViewers(
        req(`/api/routes-f/analytics-daily-viewers?channel=${CHANNEL}`, c)
      ),
  },
  {
    name: "analytics-daily-stream-minutes",
    ddl: true,
    call: c =>
      dailyStreamMinutes(
        req(
          `/api/routes-f/analytics-daily-stream-minutes?channel=${CHANNEL}`,
          c
        )
      ),
  },
  {
    name: "analytics-daily-revenue",
    ddl: true,
    call: c =>
      dailyRevenue(
        req(`/api/routes-f/analytics-daily-revenue?channel=${CHANNEL}`, c)
      ),
  },
  {
    name: "analytics-top-clips",
    ddl: true,
    call: c =>
      topClips(req(`/api/routes-f/analytics-top-clips?channel=${CHANNEL}`, c)),
  },
  {
    name: "analytics-top-tippers",
    call: c =>
      topTippers(
        req(`/api/routes-f/analytics-top-tippers?channel=${CHANNEL}`, c)
      ),
  },
  {
    name: "analytics-viewer-geo",
    call: c =>
      viewerGeo(
        req(`/api/routes-f/analytics-viewer-geo?channel=${CHANNEL}`, c)
      ),
  },
  {
    name: "analytics-session-list",
    call: c =>
      sessionList(
        req(`/api/routes-f/analytics-session-list?creator_id=${CHANNEL}`, c)
      ),
  },
  {
    name: "analytics-session-detail",
    call: c =>
      sessionDetail(
        req(
          `/api/routes-f/analytics-session-detail?session_id=${OTHER_UUID}&creator_id=${CHANNEL}`,
          c
        )
      ),
  },
  {
    name: "creator/analytics (viewers)",
    call: c =>
      creatorAnalytics(
        req("/api/routes-f/creator/analytics?metric=viewers", c)
      ),
  },
  {
    name: "creator/analytics (followers)",
    call: c =>
      creatorAnalytics(
        req("/api/routes-f/creator/analytics?metric=followers", c)
      ),
  },
  {
    name: "creator/analytics (revenue wallet lookup)",
    call: c =>
      creatorAnalytics(
        req("/api/routes-f/creator/analytics?metric=revenue", c)
      ),
  },
  {
    name: "donations/history",
    call: c =>
      donationsHistory(req("/api/routes-f/donations/history?direction=all", c)),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  mockPrimarySql.mockResolvedValue({ rows: [ROW] });
  verifySessionMock.mockResolvedValue({
    ok: true,
    userId: CHANNEL,
    wallet: null,
    privyId: "did:privy:abc",
    username: "creator",
    email: "creator@example.com",
  });
  verifyAdminMock.mockResolvedValue(true);
  requireAdminMock.mockResolvedValue(null);
  resetAppCacheForTests();
  setEnv({ POSTGRES_REPLICA_URL: REPLICA_URL });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const PUBLIC_ROUTES = new Set<string>();

describe.each(readCases)(
  "replica routing: $name",
  ({ name, call, ddl: hasDdl, readYourWrites = true }) => {
    if (!PUBLIC_ROUTES.has(name)) {
      it("never lets a shared cache store the caller's analytics", async () => {
        replicaWithLag(0);

        const res = await call();

        // A public CDN entry keyed by URL would serve one user's data to another
        // without running the auth check, and would also defeat the
        // read-your-own-writes cookie.
        expect(res.headers.get("Cache-Control") ?? "").not.toMatch(
          /public|s-maxage/
        );
      });
    }

    it("sends the analytics SELECTs to a healthy replica, not the primary", async () => {
      replicaWithLag(0);

      const res = await call();

      expect(res.status).toBe(200);
      expect(reads(mockReplicaSql).length).toBeGreaterThan(0);
      expect(reads(mockPrimarySql)).toHaveLength(0);
    });

    if (hasDdl) {
      it("keeps the ensure*() DDL on the primary", async () => {
        replicaWithLag(0);

        await call();

        expect(ddl(mockPrimarySql).length).toBeGreaterThan(0);
        expect(ddl(mockReplicaSql)).toHaveLength(0);
      });
    }

    if (readYourWrites) {
      it("reads from the primary when the caller carries a recent-write cookie", async () => {
        replicaWithLag(0);

        const res = await call(
          `${RECENT_WRITE_COOKIE}=${signToken({ w: Date.now() }, SESSION_SECRET)}`
        );

        expect(res.status).toBe(200);
        expect(reads(mockPrimarySql).length).toBeGreaterThan(0);
        expect(reads(mockReplicaSql)).toHaveLength(0);
      });
    }

    it("returns 503 with Retry-After when the replica is unavailable and fallback is full", async () => {
      setEnv({
        POSTGRES_REPLICA_URL: REPLICA_URL,
        DB_REPLICA_FALLBACK_CONCURRENCY: "0",
      });
      replicaWithLag(999);

      const res = await call();

      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("30");
      expect(reads(mockPrimarySql)).toHaveLength(0);
    });
  }
);

describe("donations/history runtime-built query on the replica", () => {
  it("sends the same text and parameters through .query()", async () => {
    replicaWithLag(0);
    const from = "2026-01-01T00:00:00.000Z";

    const res = await donationsHistory(
      req(`/api/routes-f/donations/history?direction=all&from=${from}&limit=5`)
    );

    expect(res.status).toBe(200);
    const [[text, ...values]] = reads(mockReplicaSql);
    expect(textOf(text)).toContain("(t.sender_id = $1 OR t.recipient_id = $1)");
    expect(textOf(text)).toContain("t.created_at >= $2");
    expect(values).toEqual([CHANNEL, from, 6]);
    expect(reads(mockPrimarySql)).toHaveLength(0);
  });
});

describe("read-your-own-writes marker on write handlers", () => {
  beforeEach(() => {
    setEnv({ POSTGRES_REPLICA_URL: undefined });
  });

  const expectMarked = (res: Response) => {
    expect(res.headers.get("set-cookie") ?? "").toContain(
      `${RECENT_WRITE_COOKIE}=`
    );
  };

  const json = (body: unknown, method = "POST"): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  it("analytics-daily-revenue POST", async () => {
    const res = await recordRevenue(
      req(
        "/api/routes-f/analytics-daily-revenue",
        undefined,
        json({ channel: CHANNEL, source: "tip", amount: 5 })
      )
    );

    expect(res.status).toBe(201);
    expectMarked(res);
  });

  it("does not mark a rejected analytics-daily-revenue POST", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: OTHER_UUID });

    const res = await recordRevenue(
      req(
        "/api/routes-f/analytics-daily-revenue",
        undefined,
        json({ channel: CHANNEL, source: "tip", amount: 5 })
      )
    );

    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("tips/send POST", async () => {
    mockPrimarySql.mockResolvedValue({
      rows: [{ stellar_public_key: "GSENDERKEY" }],
    });

    const res = await tipsSend(
      req(
        "/api/tips/send",
        undefined,
        json({ destinationPublicKey: "GDEST", amount: "1" })
      )
    );

    expect(res.status).toBe(200);
    expectMarked(res);
  });

  it("routes-f/tip-confirm POST", async () => {
    mockPrimarySql.mockImplementation((s: Strings) => {
      const text = textOf(s);
      if (text.includes("FROM channels")) {
        return Promise.resolve({ rows: [{ user_id: OTHER_UUID }] });
      }
      if (text.includes("INSERT INTO tips")) {
        return Promise.resolve({
          rows: [{ id: "tip-1", created_at: ROW.created_at }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await tipConfirm(
      req(
        "/api/routes-f/tip-confirm",
        undefined,
        json({
          tx_hash: "a".repeat(64),
          amount: "10.0000000",
          recipient_channel_id: "chan",
        })
      )
    );

    expect(res.status).toBe(201);
    expectMarked(res);
  });

  it("streams/start POST", async () => {
    const user = {
      id: CHANNEL,
      username: "creator",
      mux_stream_id: "mux-1",
      mux_playback_id: "pb-1",
      is_live: false,
    };
    mockPrimarySql
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValue({ rows: [] });

    const res = await streamStart(
      req("/api/streams/start", undefined, { method: "POST" })
    );

    expect(res.status).toBe(200);
    expectMarked(res);
  });

  it("streams/start DELETE", async () => {
    mockPrimarySql
      .mockResolvedValueOnce({
        rows: [{ id: CHANNEL, mux_stream_id: "mux-1", is_live: true }],
      })
      .mockResolvedValue({ rows: [] });

    const res = await streamStop(
      req("/api/streams/start", undefined, { method: "DELETE" })
    );

    expect(res.status).toBe(200);
    expectMarked(res);
  });

  it("streams/delete DELETE", async () => {
    mockPrimarySql
      .mockResolvedValueOnce({
        rows: [{ id: CHANNEL, mux_stream_id: "mux-1", is_live: false }],
      })
      .mockResolvedValue({ rows: [] });

    const res = await streamDelete(
      req("/api/streams/delete", undefined, { method: "DELETE" })
    );

    expect(res.status).toBe(200);
    expectMarked(res);
  });
});
