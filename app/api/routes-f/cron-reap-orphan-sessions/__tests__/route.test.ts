/**
 * @jest-environment node
 *
 * Tests for the orphaned-session reaper (#1402).
 *
 * The Mux API and the database are both faked in-memory, so the assertions
 * check real state transitions (was the row actually closed?) rather than
 * "the mock was called".
 */
import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { sql } from "@vercel/postgres";
import { hasOpenSession } from "@/lib/stream/session-consistency";

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));

const sqlMock = sql as unknown as jest.Mock;
const ORIGINAL_ENV = process.env;

interface FakeSession {
  id: string;
  user_id: string;
  mux_session_id: string | null;
  started_at: string;
  ended_at: string | null;
  ended_at_estimated: boolean;
  username: string;
  user_is_live: boolean;
  user_mux_stream_id: string | null;
}

const HOUR = 60 * 60 * 1000;

let sessions: FakeSession[];
let userLiveState: Record<string, boolean>;
/** Ids whose close is silently lost, simulating a webhook closing first. */
let closedByWebhookDuringRun: Set<string>;
let muxListResponse: { status: number } | { ids: string[] };
let muxPerStreamStatus: Record<string, string | null>;
let muxPerStreamHttpStatus: number;
let fetchedUrls: string[];

let idCounter = 0;
function makeSession(overrides: Partial<FakeSession> = {}): FakeSession {
  idCounter += 1;
  const id = `session-${idCounter}`;
  return {
    id,
    user_id: `user-${idCounter}`,
    mux_session_id: `mux-${idCounter}`,
    started_at: new Date(Date.now() - 5 * HOUR).toISOString(),
    ended_at: null,
    ended_at_estimated: false,
    username: `streamer-${idCounter}`,
    user_is_live: true,
    user_mux_stream_id: `mux-${idCounter}`,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  idCounter = 0;
  sessions = [];
  userLiveState = {};
  closedByWebhookDuringRun = new Set();
  muxListResponse = { ids: [] };
  muxPerStreamStatus = {};
  muxPerStreamHttpStatus = 200;
  fetchedUrls = [];

  process.env = {
    ...ORIGINAL_ENV,
    CRON_SECRET: "test-cron-secret",
    MUX_TOKEN_ID: "mux-token-id",
    MUX_TOKEN_SECRET: "mux-token-secret",
  };
  delete process.env.ORPHAN_SESSION_ALERT_WEBHOOK_URL;
  delete process.env.OPS_ALERT_WEBHOOK_URL;
  delete process.env.ORPHAN_SESSION_MIN_AGE_MINUTES;
  delete process.env.ORPHAN_SESSION_ALERT_THRESHOLD;

  sqlMock.mockImplementation(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(" ");

      if (query.includes("UPDATE stream_sessions")) {
        const id = String(values[0]);
        const row = sessions.find(s => s.id === id);
        if (!row || row.ended_at !== null || closedByWebhookDuringRun.has(id)) {
          return { rows: [], rowCount: 0 };
        }
        row.ended_at = new Date().toISOString();
        row.ended_at_estimated = true;
        return { rows: [{ id: row.id, ended_at: row.ended_at }], rowCount: 1 };
      }

      if (query.includes("UPDATE users SET")) {
        userLiveState[String(values[0])] = false;
        return { rows: [], rowCount: 1 };
      }

      if (query.includes("FROM stream_sessions") && query.includes("LIMIT 1")) {
        // active-session dedup check
        const userId = String(values[0]);
        const open = sessions.filter(
          s => s.user_id === userId && s.ended_at === null
        );
        return { rows: open.map(s => ({ id: s.id })), rowCount: open.length };
      }

      // candidate scan
      const open = sessions.filter(s => s.ended_at === null);
      return { rows: open, rowCount: open.length };
    }
  );

  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchedUrls.push(url);

    if (url.includes("api.mux.com/video/v1/live-streams")) {
      const isSingleStream = !url.includes("?");
      if (isSingleStream) {
        if (muxPerStreamHttpStatus !== 200) {
          return jsonResponse({ error: "boom" }, muxPerStreamHttpStatus);
        }
        const streamId = url.split("/").pop() as string;
        return jsonResponse({
          data: {
            id: streamId,
            status: muxPerStreamStatus[streamId] ?? "idle",
          },
        });
      }

      if ("status" in muxListResponse) {
        return jsonResponse({ error: "boom" }, muxListResponse.status);
      }
      return jsonResponse({
        data: muxListResponse.ids.map(id => ({ id })),
      });
    }

    // ops alert webhook
    return jsonResponse({ ok: true });
  }) as unknown as typeof fetch;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function postRequest(authorized = true): NextRequest {
  const headers: Record<string, string> = {};
  if (authorized) {
    headers.authorization = "Bearer test-cron-secret";
  }
  return new NextRequest(
    "http://localhost/api/routes-f/cron-reap-orphan-sessions",
    { method: "POST", headers }
  );
}

describe("POST /api/routes-f/cron-reap-orphan-sessions", () => {
  it("rejects an unauthorized request and touches nothing", async () => {
    sessions = [makeSession()];

    const res = await POST(postRequest(false));

    expect(res.status).toBe(401);
    expect(sessions[0].ended_at).toBeNull();
  });

  it("keeps a session open while its stream is still active in Mux, however old the row is", async () => {
    const session = makeSession({
      mux_session_id: "mux-live-now",
      started_at: new Date(Date.now() - 9 * HOUR).toISOString(),
    });
    sessions = [session];
    muxListResponse = { ids: ["mux-live-now"] };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessions_closed).toBe(0);
    expect(data.sessions_still_active).toBe(1);
    expect(session.ended_at).toBeNull();
    // no per-row Mux lookup needed once the stream is known active
    expect(fetchedUrls.filter(u => /live-streams\/mux/.test(u))).toHaveLength(
      0
    );
  });

  it("force-closes a stale session whose stream is not active in Mux, flagging the estimate", async () => {
    const session = makeSession({ mux_session_id: "mux-orphan" });
    sessions = [session];
    muxListResponse = { ids: [] };
    muxPerStreamStatus = { "mux-orphan": "idle" };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessions_closed).toBe(1);
    expect(session.ended_at).not.toBeNull();
    expect(session.ended_at_estimated).toBe(true);
    expect(data.corrections).toHaveLength(1);
    expect(data.corrections[0].session_id).toBe(session.id);
    expect(data.corrections[0].estimated_end).toBeDefined();
    expect(data.corrections[0].mux_stream_id).toBe("mux-orphan");
    expect(userLiveState[session.user_id]).toBe(false);
  });

  it("closes nothing at all when Mux cannot be queried (fail closed)", async () => {
    sessions = [makeSession()];
    muxListResponse = { status: 500 };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.ground_truth_reachable).toBe(false);
    expect(data.sessions_closed).toBe(0);
    expect(sessions[0].ended_at).toBeNull();
  });

  it("closes nothing when Mux credentials are missing", async () => {
    delete process.env.MUX_TOKEN_ID;
    sessions = [makeSession()];

    const res = await POST(postRequest());
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.sessions_closed).toBe(0);
    expect(sessions[0].ended_at).toBeNull();
  });

  it("leaves a session open when the per-row re-check finds the stream started after the snapshot", async () => {
    const session = makeSession({ mux_session_id: "mux-just-started" });
    sessions = [session];
    muxListResponse = { ids: [] };
    muxPerStreamStatus = { "mux-just-started": "active" };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(data.sessions_closed).toBe(0);
    expect(data.sessions_still_active).toBe(1);
    expect(session.ended_at).toBeNull();
  });

  it("leaves a session open when the per-row re-check fails (unknown is not inactive)", async () => {
    const session = makeSession({ mux_session_id: "mux-flaky" });
    sessions = [session];
    muxListResponse = { ids: [] };
    muxPerStreamHttpStatus = 502;

    const res = await POST(postRequest());
    const data = await res.json();

    expect(data.sessions_closed).toBe(0);
    expect(session.ended_at).toBeNull();
  });

  it("does not touch a session younger than the staleness threshold", async () => {
    const session = makeSession({
      mux_session_id: "mux-recent",
      started_at: new Date(Date.now() - 60 * 1000).toISOString(),
    });
    sessions = [session];
    muxListResponse = { ids: [] };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(data.sessions_closed).toBe(0);
    expect(session.ended_at).toBeNull();
  });

  it("respects ORPHAN_SESSION_MIN_AGE_MINUTES", async () => {
    process.env.ORPHAN_SESSION_MIN_AGE_MINUTES = "1";
    const session = makeSession({
      mux_session_id: "mux-2min",
      started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    });
    sessions = [session];
    muxListResponse = { ids: [] };
    muxPerStreamStatus = { "mux-2min": "idle" };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(data.sessions_closed).toBe(1);
    expect(session.ended_at).not.toBeNull();
  });

  it("leaves rows without a Mux stream id alone (nothing to cross-check)", async () => {
    const session = makeSession({
      mux_session_id: null,
      user_mux_stream_id: null,
    });
    sessions = [session];
    muxListResponse = { ids: [] };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(data.sessions_closed).toBe(0);
    expect(data.sessions_unverifiable).toBe(1);
    expect(session.ended_at).toBeNull();
  });

  it("does not overwrite an ended_at written by a webhook mid-run", async () => {
    const session = makeSession({ mux_session_id: "mux-racing" });
    sessions = [session];
    muxListResponse = { ids: [] };
    muxPerStreamStatus = { "mux-racing": "idle" };
    closedByWebhookDuringRun.add(session.id);

    const res = await POST(postRequest());
    const data = await res.json();

    expect(data.sessions_closed).toBe(0);
    expect(data.sessions_already_closed).toBe(1);
    expect(session.ended_at_estimated).toBe(false);
  });

  it("makes the closed row invisible to the active-session dedup check", async () => {
    const session = makeSession({ mux_session_id: "mux-dedup" });
    sessions = [session];
    muxListResponse = { ids: [] };
    muxPerStreamStatus = { "mux-dedup": "idle" };

    // Before the reaper runs the orphan blocks a new session.
    await expect(hasOpenSession(session.user_id)).resolves.toBe(true);

    const res = await POST(postRequest());
    const data = await res.json();
    expect(data.sessions_closed).toBe(1);

    // After the correction it no longer does.
    await expect(hasOpenSession(session.user_id)).resolves.toBe(false);
  });

  it("alerts via the ops webhook when corrections exceed the threshold", async () => {
    process.env.ORPHAN_SESSION_ALERT_THRESHOLD = "1";
    process.env.ORPHAN_SESSION_ALERT_WEBHOOK_URL =
      "https://ops.example.com/alerts";
    const first = makeSession({ mux_session_id: "mux-a" });
    const second = makeSession({ mux_session_id: "mux-b" });
    sessions = [first, second];
    muxListResponse = { ids: [] };
    muxPerStreamStatus = { "mux-a": "idle", "mux-b": "disabled" };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(data.sessions_closed).toBe(2);
    expect(data.alert).toBe(true);
    expect(
      fetchedUrls.filter(u => u === "https://ops.example.com/alerts")
    ).toHaveLength(1);
  });

  it("does not alert on a single correction under the default threshold", async () => {
    sessions = [makeSession({ mux_session_id: "mux-single" })];
    muxListResponse = { ids: [] };
    muxPerStreamStatus = { "mux-single": "idle" };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(data.sessions_closed).toBe(1);
    expect(data.alert).toBe(false);
  });

  it("alerts when the job itself degrades", async () => {
    process.env.ORPHAN_SESSION_ALERT_WEBHOOK_URL =
      "https://ops.example.com/degraded";
    sessions = [makeSession()];
    muxListResponse = { status: 500 };

    const res = await POST(postRequest());

    expect(res.status).toBe(503);
    expect(
      fetchedUrls.filter(u => u === "https://ops.example.com/degraded")
    ).toHaveLength(1);
  });

  it("handles a fully healthy run with no orphaned rows", async () => {
    sessions = [makeSession({ mux_session_id: "mux-live-1" })];
    muxListResponse = { ids: ["mux-live-1"] };

    const res = await POST(postRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ran).toBe(true);
    expect(data.ground_truth_reachable).toBe(true);
    expect(data.active_streams).toBe(1);
    expect(data.sessions_closed).toBe(0);
    expect(data.sessions_with_errors).toBe(0);
  });
});

describe("GET /api/routes-f/cron-reap-orphan-sessions", () => {
  it("requires authorization", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/routes-f/cron-reap-orphan-sessions")
    );
    expect(res.status).toBe(401);
  });
});
