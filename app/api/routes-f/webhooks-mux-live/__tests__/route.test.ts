import { createHmac } from "crypto";
import { sql } from "@vercel/postgres";
import { POST, GET } from "../route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));

const sqlMock = sql as unknown as jest.Mock;
const STREAM_ID = "mux-stream-abc123";
const WEBHOOK_SECRET = "test-webhook-secret";

function signedHeader(
  rawBody: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
) {
  const sig = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

function postRequest(
  event: unknown,
  opts?: { secret?: string; header?: string | null }
): Request {
  const rawBody = JSON.stringify(event);
  const headers = new Headers();
  headers.set("x-forwarded-for", "127.0.0.1");

  if (opts?.header !== null) {
    const secret = opts?.secret ?? WEBHOOK_SECRET;
    headers.set("mux-signature", opts?.header ?? signedHeader(rawBody, secret));
  }

  return new Request("http://localhost/api/routes-f/webhooks-mux-live", {
    method: "POST",
    headers,
    body: rawBody,
  }) as any;
}

describe("POST /api/routes-f/webhooks-mux-live", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, MUX_WEBHOOK_SECRET: WEBHOOK_SECRET };
    sqlMock.mockResolvedValue({ rows: [] });
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns 401 when the signature header is missing", async () => {
    const res = await POST(
      postRequest(
        { type: "video.live_stream.idle", data: { id: STREAM_ID } },
        { header: null }
      )
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature is invalid", async () => {
    const res = await POST(
      postRequest(
        { type: "video.live_stream.idle", data: { id: STREAM_ID } },
        { header: "t=1,v1=deadbeef" }
      )
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature timestamp is older than 5 minutes", async () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 400;
    const rawBody = JSON.stringify({
      type: "video.live_stream.idle",
      data: { id: STREAM_ID },
    });
    const res = await POST(
      postRequest(JSON.parse(rawBody), {
        header: signedHeader(rawBody, WEBHOOK_SECRET, staleTimestamp),
      })
    );
    expect(res.status).toBe(401);
  });

  it("allows the request through (with a warning) when MUX_WEBHOOK_SECRET is unset", async () => {
    delete process.env.MUX_WEBHOOK_SECRET;
    const res = await POST(
      postRequest(
        { type: "video.live_stream.idle", data: { id: STREAM_ID } },
        { header: null }
      )
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when the event has no stream ID", async () => {
    const res = await POST(
      postRequest({ type: "video.live_stream.active", data: {} })
    );
    expect(res.status).toBe(400);
  });

  it("marks the user live and opens a stream session on video.live_stream.active", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users is_live = true
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            mux_playback_id: "pb-1",
            creator: { title: "My Stream" },
          },
        ],
      }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }) // SELECT existing session -> none
      .mockResolvedValueOnce({ rows: [] }); // INSERT stream_sessions

    const res = await POST(
      postRequest({ type: "video.live_stream.active", data: { id: STREAM_ID } })
    );
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(4);
  });

  it("skips creating a duplicate session when one is already active", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users
      .mockResolvedValueOnce({
        rows: [{ id: "user-1", mux_playback_id: "pb-1", creator: {} }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "existing-session" }] }); // already active

    const res = await POST(
      postRequest({ type: "video.live_stream.active", data: { id: STREAM_ID } })
    );
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(3); // no INSERT
  });

  it("logs and does not touch the DB on video.live_stream.connected", async () => {
    const res = await POST(
      postRequest({
        type: "video.live_stream.connected",
        data: { id: STREAM_ID },
      })
    );
    expect(res.status).toBe(200);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("logs and does not touch the DB on video.live_stream.disconnected", async () => {
    const res = await POST(
      postRequest({
        type: "video.live_stream.disconnected",
        data: { id: STREAM_ID },
      })
    );
    expect(res.status).toBe(200);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("marks the user offline and closes the session on video.live_stream.idle", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users is_live = false
      .mockResolvedValueOnce({ rows: [{ id: "user-1" }] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }); // UPDATE stream_sessions ended_at

    const res = await POST(
      postRequest({ type: "video.live_stream.idle", data: { id: STREAM_ID } })
    );
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });

  it("returns 200 with received:true for an unrecognized event type", async () => {
    const res = await POST(
      postRequest({
        type: "video.live_stream.created",
        data: { id: STREAM_ID },
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    sqlMock.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(
      postRequest({ type: "video.live_stream.active", data: { id: STREAM_ID } })
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/routes-f/webhooks-mux-live", () => {
  it("returns a health-check payload", async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.events).toContain("video.live_stream.active");
  });
});
