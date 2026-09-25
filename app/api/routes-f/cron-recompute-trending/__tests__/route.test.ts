/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as store from "../store";
import { getRankingTable, resetRankingTable } from "../store";

jest.mock("../store", () => {
  const actual = jest.requireActual("../store");
  return { ...actual, getSourceStreams: jest.fn(actual.getSourceStreams) };
});

const ORIGINAL_ENV = process.env;

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/cron-recompute-trending",
    {
      method: "POST",
      headers,
    }
  );
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-cron-secret" };
  resetRankingTable();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/routes-f/cron-recompute-trending", () => {
  it("rejects requests without the correct CRON_SECRET bearer token", async () => {
    const res = await POST(req({ authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
  });

  it("rejects requests missing the authorization header entirely", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("ranks streams highest-score first using the same formula as trending-streams", async () => {
    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ranked_count).toBe(4);
    // stream-2: 150*0.6 + 100*0.4 = 130 (highest)
    expect(data.ranking[0].stream_id).toBe("stream-2");
    expect(data.ranking[0].rank).toBe(1);
    expect(data.ranking[0].score).toBeCloseTo(130);
  });

  it("orders a declining stream below flat/growing ones", async () => {
    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    const ranks = Object.fromEntries(
      data.ranking.map((r: { stream_id: string; rank: number }) => [
        r.stream_id,
        r.rank,
      ])
    );
    // stream-3 (declining, velocity -80) should rank below stream-1 (flat, velocity 0)
    expect(ranks["stream-3"]).toBeGreaterThan(ranks["stream-1"]);
  });

  it("gives a stream with no prior snapshot a velocity of exactly 0", async () => {
    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    const brandNew = data.ranking.find(
      (r: { stream_id: string }) => r.stream_id === "stream-4"
    );
    expect(brandNew.viewer_velocity).toBe(0);
  });

  it("persists the computed ranking to the store", async () => {
    await POST(req({ authorization: "Bearer test-cron-secret" }));

    const table = getRankingTable();
    expect(table.length).toBe(4);
    expect(table[0].rank).toBe(1);
  });

  it("recomputing overwrites the previous ranking table rather than appending", async () => {
    await POST(req({ authorization: "Bearer test-cron-secret" }));
    await POST(req({ authorization: "Bearer test-cron-secret" }));

    const table = getRankingTable();
    expect(table.length).toBe(4);
  });

  it("returns 500 when recompute throws", async () => {
    (store.getSourceStreams as jest.Mock).mockImplementationOnce(() => {
      throw new Error("source unavailable");
    });

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    expect(res.status).toBe(500);
  });
});
