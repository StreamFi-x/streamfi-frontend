/**
 * @jest-environment node
 */
import {
  classifyOpenSession,
  confirmStreamStopped,
  fetchMuxGroundTruth,
  getReaperConfig,
  hasOpenSession,
  type MuxGroundTruth,
  type OpenSessionCandidate,
} from "../session-consistency";
import { sql } from "@vercel/postgres";

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

const sqlMock = sql as unknown as jest.Mock;
const ORIGINAL_ENV = process.env;
const MINUTE = 60 * 1000;

function groundTruth(ids: string[], reachable = true): MuxGroundTruth {
  return { reachable, activeStreamIds: new Set(ids) };
}

function candidate(
  overrides: Partial<OpenSessionCandidate> = {}
): OpenSessionCandidate {
  return {
    id: "session-1",
    user_id: "user-1",
    username: "streamer",
    mux_stream_id: "mux-1",
    started_at: new Date(Date.now() - 60 * MINUTE).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ORPHAN_SESSION_MIN_AGE_MINUTES;
  delete process.env.ORPHAN_SESSION_ALERT_THRESHOLD;
  delete process.env.ORPHAN_SESSION_ALERT_WEBHOOK_URL;
  delete process.env.OPS_ALERT_WEBHOOK_URL;
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("classifyOpenSession", () => {
  const options = { minOrphanAgeMs: 15 * MINUTE };

  it("keeps a session whose stream Mux reports as active", () => {
    const decision = classifyOpenSession(
      candidate({ mux_stream_id: "mux-live" }),
      groundTruth(["mux-live"]),
      options
    );
    expect(decision.action).toBe("keep_open");
  });

  it("keeps every session when Mux ground truth is unavailable", () => {
    const decision = classifyOpenSession(
      candidate(),
      groundTruth([], false),
      options
    );
    expect(decision.action).toBe("keep_open");
  });

  it("keeps a session with no Mux stream id", () => {
    const decision = classifyOpenSession(
      candidate({ mux_stream_id: null }),
      groundTruth([]),
      options
    );
    expect(decision.action).toBe("keep_open");
  });

  it("keeps a session younger than the staleness threshold", () => {
    const decision = classifyOpenSession(
      candidate({
        started_at: new Date(Date.now() - 5 * MINUTE).toISOString(),
      }),
      groundTruth([]),
      options
    );
    expect(decision.action).toBe("keep_open");
  });

  it("force-closes a stale session whose stream is not active", () => {
    const decision = classifyOpenSession(
      candidate({
        started_at: new Date(Date.now() - 90 * MINUTE).toISOString(),
      }),
      groundTruth([]),
      options
    );
    expect(decision.action).toBe("force_close");
    if (decision.action === "force_close") {
      expect(decision.age_minutes).toBe(90);
    }
  });
});

describe("getReaperConfig", () => {
  it("defaults to a 15 minute staleness threshold and an alert threshold of 5", () => {
    const config = getReaperConfig({});
    expect(config.minOrphanAgeMs).toBe(15 * MINUTE);
    expect(config.alertThreshold).toBe(5);
  });

  it("reads overrides from the environment", () => {
    const config = getReaperConfig({
      ORPHAN_SESSION_MIN_AGE_MINUTES: "30",
      ORPHAN_SESSION_ALERT_THRESHOLD: "2",
      ORPHAN_SESSION_ALERT_WEBHOOK_URL: "https://ops.example.com/hook",
    } as NodeJS.ProcessEnv);
    expect(config.minOrphanAgeMs).toBe(30 * MINUTE);
    expect(config.alertThreshold).toBe(2);
    expect(config.alertWebhookUrl).toBe("https://ops.example.com/hook");
  });

  it("ignores garbage values instead of disabling the job", () => {
    const config = getReaperConfig({
      ORPHAN_SESSION_MIN_AGE_MINUTES: "not-a-number",
      ORPHAN_SESSION_ALERT_THRESHOLD: "-3",
    } as NodeJS.ProcessEnv);
    expect(config.minOrphanAgeMs).toBe(15 * MINUTE);
    expect(config.alertThreshold).toBe(5);
  });
});

describe("fetchMuxGroundTruth", () => {
  it("collects active stream ids across pages", async () => {
    process.env.MUX_TOKEN_ID = "id";
    process.env.MUX_TOKEN_SECRET = "secret";

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ id: "a" }], next_cursor: "page-2" }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "b" }] }), { status: 200 })
      );

    const truth = await fetchMuxGroundTruth();

    expect(truth.reachable).toBe(true);
    expect([...truth.activeStreamIds].sort()).toEqual(["a", "b"]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("reports unreachable when credentials are missing", async () => {
    delete process.env.MUX_TOKEN_ID;
    delete process.env.MUX_TOKEN_SECRET;

    const truth = await fetchMuxGroundTruth();

    expect(truth.reachable).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reports unreachable on a non-2xx response", async () => {
    process.env.MUX_TOKEN_ID = "id";
    process.env.MUX_TOKEN_SECRET = "secret";
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response("nope", { status: 429 })
    );

    const truth = await fetchMuxGroundTruth();

    expect(truth.reachable).toBe(false);
    expect(truth.error).toContain("429");
  });

  it("reports unreachable when the request throws", async () => {
    process.env.MUX_TOKEN_ID = "id";
    process.env.MUX_TOKEN_SECRET = "secret";
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("socket hang up")
    );

    const truth = await fetchMuxGroundTruth();

    expect(truth.reachable).toBe(false);
    expect(truth.error).toContain("socket hang up");
  });
});

describe("confirmStreamStopped", () => {
  beforeEach(() => {
    process.env.MUX_TOKEN_ID = "id";
    process.env.MUX_TOKEN_SECRET = "secret";
  });

  it.each([
    ["idle", "inactive"],
    ["disabled", "inactive"],
    ["active", "active"],
  ])("maps Mux status %s to %s", async (status, expected) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { status } }), { status: 200 })
    );
    await expect(confirmStreamStopped("mux-1")).resolves.toBe(expected);
  });

  it("is unknown when the API call fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response("nope", { status: 500 })
    );
    await expect(confirmStreamStopped("mux-1")).resolves.toBe("unknown");
  });

  it("is unknown when credentials are missing", async () => {
    delete process.env.MUX_TOKEN_ID;
    await expect(confirmStreamStopped("mux-1")).resolves.toBe("unknown");
  });
});

describe("hasOpenSession", () => {
  it("filters on ended_at IS NULL, so force-closed rows never count as active", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    await expect(hasOpenSession("user-1")).resolves.toBe(false);

    const [strings] = sqlMock.mock.calls[0] as [TemplateStringsArray];
    expect(strings.join(" ")).toContain("ended_at IS NULL");
  });

  it("reports an open session as active", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "session-1" }] });

    await expect(hasOpenSession("user-1")).resolves.toBe(true);
  });
});
