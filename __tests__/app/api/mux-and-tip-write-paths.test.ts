/**
 * @jest-environment node
 *
 * Write paths that feed the reconciliation sweeps (#1409, #1405).
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));
jest.mock("@/lib/mux/server", () => ({
  deleteMuxAssetIfExists: jest.fn(async () => "deleted"),
}));
jest.mock("@/lib/stellar/horizon", () => ({
  fetchPaymentsReceived: jest.fn(),
}));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: jest.fn(async () => undefined),
}));
jest.mock("@/lib/routes-f/price", () => ({
  getXlmUsdPrice: jest.fn(async () => 0.1),
}));

import { deleteMuxAssetIfExists } from "@/lib/mux/server";
import { fetchPaymentsReceived } from "@/lib/stellar/horizon";
import { POST as muxWebhook } from "@/app/api/webhooks/mux/route";
import { DELETE as deleteRecording } from "@/app/api/streams/recordings/[wallet]/route";
import { POST as refreshTotal } from "@/app/api/tips/refresh-total/route";

const USER = "11111111-1111-1111-1111-111111111111";
const RECORDING = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  delete process.env.MUX_WEBHOOK_SECRET;
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("Mux video.asset.ready webhook", () => {
  const event = {
    type: "video.asset.ready",
    data: {
      id: "asset-1",
      playback_ids: [{ id: "pb-1" }],
      duration: 61.4,
      live_stream_id: "ls-1",
    },
  };
  const post = () =>
    muxWebhook(
      new Request("http://localhost/api/webhooks/mux", {
        method: "POST",
        body: JSON.stringify(event),
      })
    );

  beforeEach(() => {
    mockDb.on(/SELECT id, mux_playback_id, creator FROM users/, {
      rows: [{ id: USER, creator: { streamTitle: "Speedrun" } }],
    });
    mockDb.on(/FROM stream_sessions/, { rows: [{ id: "sess-1" }] });
  });

  it("stores the recording", async () => {
    mockDb.on(/INSERT INTO stream_recordings/, { rows: [{ inserted: true }] });
    const res = await post();
    expect(res.status).toBe(200);
    const [insert] = mockDb.callsMatching(/INSERT INTO stream_recordings/);
    expect(insert.values).toEqual([
      USER,
      "sess-1",
      "asset-1",
      "pb-1",
      "Speedrun",
      61,
    ]);
  });

  it("returns 500 on a database failure so Mux redelivers the event", async () => {
    mockDb.on(/INSERT INTO stream_recordings/, () => {
      throw new Error("connection reset");
    });
    const res = await post();
    expect(res.status).toBe(500);
  });

  it("acknowledges an asset it cannot attribute (the sweep reports it)", async () => {
    mockDb.reset();
    mockDb.on(/SELECT id, mux_playback_id, creator FROM users/, { rows: [] });
    const res = await post();
    expect(res.status).toBe(200);
    expect(mockDb.callsMatching(/INSERT INTO stream_recordings/)).toHaveLength(
      0
    );
  });
});

describe("DELETE /api/streams/recordings/[id]", () => {
  const params = { params: Promise.resolve({ wallet: RECORDING }) };
  const req = () =>
    new NextRequest(`http://localhost/api/streams/recordings/${RECORDING}`, {
      method: "DELETE",
      headers: { cookie: "privy_session=did:privy:user" },
    });

  beforeEach(() => {
    mockDb.on(/FROM users\s+WHERE privy_id =/, {
      rows: [{ id: USER, privy_id: "did:privy:user", deleted_at: null }],
    });
    mockDb.on(/SELECT user_id, mux_asset_id FROM stream_recordings/, {
      rows: [{ user_id: USER, mux_asset_id: "asset-9" }],
    });
    mockDb.on(/DELETE FROM stream_recordings/, { rowCount: 1 });
  });

  it("deletes the row and then the Mux asset", async () => {
    const res = await deleteRecording(req(), params);
    expect(res.status).toBe(200);
    expect(deleteMuxAssetIfExists).toHaveBeenCalledWith("asset-9");
  });

  it("still succeeds when Mux is unavailable (the sweep reports the orphan)", async () => {
    (deleteMuxAssetIfExists as jest.Mock).mockRejectedValueOnce(
      new Error("mux down")
    );
    const res = await deleteRecording(req(), params);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/tips/refresh-total", () => {
  it("sums amounts exactly and upserts against the partial unique index", async () => {
    (fetchPaymentsReceived as jest.Mock).mockResolvedValueOnce({
      tips: [
        {
          sender: "GS",
          amount: "0.1000000",
          txHash: "tx1",
          timestamp: "2026-09-25T00:00:00Z",
        },
        {
          sender: "GS",
          amount: "0.2000000",
          txHash: "tx2",
          timestamp: "2026-09-24T00:00:00Z",
        },
      ],
      nextCursor: undefined,
    });
    mockDb.on(/SELECT id, username, wallet AS stellar_public_key/, {
      rows: [{ id: USER, username: "alice", stellar_public_key: "GW" }],
    });
    mockDb.on(/WHERE wallet = /, { rows: [] });
    mockDb.on(/INSERT INTO tip_transactions/, { rowCount: 1 });
    mockDb.on(/UPDATE users/, { rowCount: 1 });

    const res = await refreshTotal(
      new Request("http://localhost/api/tips/refresh-total", {
        method: "POST",
        body: JSON.stringify({ username: "alice" }),
      })
    );

    expect(res.status).toBe(200);
    expect((await res.json()).totalReceived).toBe("0.3000000");
    const [insert] = mockDb.callsMatching(/INSERT INTO tip_transactions/);
    expect(insert.text).toMatch(
      /ON CONFLICT \(tx_hash\) WHERE tx_hash IS NOT NULL DO NOTHING/
    );
  });
});
