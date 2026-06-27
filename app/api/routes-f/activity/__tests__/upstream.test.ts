import { sql } from "@vercel/postgres";
import { POST as followPost } from "../../follows/route";
import { POST as streamStartPost } from "../../streams/start/route";
import { POST as tipPaymentPost } from "../../tips/payment/route";
import { verifySession } from "@/lib/auth/verify-session";

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

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("@/app/api/routes-f/activity/_lib/insert", () => ({
  insertActivityEvent: jest.fn().mockResolvedValue({ id: "mock-event-id" }),
}));

import { insertActivityEvent } from "@/app/api/routes-f/activity/_lib/insert";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const insertMock = insertActivityEvent as jest.Mock;

const FOLLOWER_ID = "550e8400-e29b-41d4-a716-446655440001";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440002";

function jsonReq(url: string, body: object): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "session=token" },
    body: JSON.stringify(body),
  }) as any;
}

describe("Activity upstream side effects (routes-f)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue({ ok: true, userId: FOLLOWER_ID });
  });

  it("routes-f/follows POST inserts new_follower for the creator", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CREATOR_ID, username: "alice", avatar: null, bio: null }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ follower_id: FOLLOWER_ID }] })
      .mockResolvedValueOnce({ rows: [{ follower_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });

    const res = await followPost(
      jsonReq("http://localhost/api/routes-f/follows", { creator_id: CREATOR_ID })
    );
    expect(res.status).toBe(201);
    expect(insertMock).toHaveBeenCalledWith({
      userId: CREATOR_ID,
      type: "new_follower",
      actorId: FOLLOWER_ID,
      metadata: { source: "routes-f/follows" },
    });
  });

  it("routes-f/streams/start POST inserts stream_started", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: CREATOR_ID });
    sqlMock.mockResolvedValueOnce({ rows: [{ username: "alice" }] });

    const res = await streamStartPost(
      jsonReq("http://localhost/api/routes-f/streams/start", {
        stream_title: "Friday Night Stream",
        peak_viewers: 42,
      })
    );
    expect(res.status).toBe(201);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CREATOR_ID,
        type: "stream_started",
        metadata: expect.objectContaining({
          stream_title: "Friday Night Stream",
          peak_viewers: 42,
        }),
      })
    );
  });

  it("routes-f/tips/payment POST inserts tip_received and tip_sent", async () => {
    const res = await tipPaymentPost(
      jsonReq("http://localhost/api/routes-f/tips/payment", {
        creator_id: CREATOR_ID,
        amount: "10",
        currency: "XLM",
        tx_hash: "stellar-tx-abc",
      })
    );
    expect(res.status).toBe(201);
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CREATOR_ID,
        type: "tip_received",
        actorId: FOLLOWER_ID,
      })
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: FOLLOWER_ID,
        type: "tip_sent",
        actorId: CREATOR_ID,
      })
    );
  });
});
