/**
 * @jest-environment node
 *
 * Recording write paths that feed the Mux asset sweep (#1409).
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

import { deleteMuxAssetIfExists } from "@/lib/mux/server";
import { assetHandlers } from "@/lib/mux/webhook-handlers";
import { DELETE as deleteRecording } from "@/app/api/streams/recordings/[wallet]/route";

const USER = "11111111-1111-1111-1111-111111111111";
const RECORDING = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("video.asset.ready handler (shared by both Mux webhooks)", () => {
  const event = {
    id: "evt-1",
    type: "video.asset.ready",
    data: {
      id: "asset-1",
      playback_ids: [{ id: "pb-1" }],
      duration: 61.4,
      live_stream_id: "ls-1",
    },
  };

  function txMock() {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const tx = {
      sql: jest.fn(
        async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const text = strings.join("$?").replace(/\s+/g, " ");
          calls.push({ text, values });
          if (/FROM users/.test(text)) {
            return {
              rows: [{ id: USER, creator: { streamTitle: "Speedrun" } }],
              rowCount: 1,
            };
          }
          if (/FROM stream_sessions/.test(text)) {
            return { rows: [{ id: "sess-1" }], rowCount: 1 };
          }
          return { rows: [{ inserted: true }], rowCount: 1 };
        }
      ),
    };
    return { tx, calls };
  }

  it("writes the recording through the shared upsert inside the event transaction", async () => {
    const { tx, calls } = txMock();
    await assetHandlers({ notifyOwner: false })["video.asset.ready"](
      tx as never,
      event
    );
    const insert = calls.find(c =>
      /INSERT INTO stream_recordings/.test(c.text)
    )!;
    expect(insert.values).toEqual([
      USER,
      "sess-1",
      "asset-1",
      "pb-1",
      "Speedrun",
      61,
    ]);
    expect(insert.text).toMatch(/playback_id = EXCLUDED.playback_id/);
  });

  it("propagates a database failure so the event is retried", async () => {
    const { tx } = txMock();
    tx.sql.mockImplementation(async (strings: TemplateStringsArray) => {
      if (/INSERT INTO stream_recordings/.test(strings.join(""))) {
        throw new Error("connection reset");
      }
      return /FROM users/.test(strings.join(""))
        ? { rows: [{ id: USER, creator: {} }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    });
    await expect(
      assetHandlers({ notifyOwner: false })["video.asset.ready"](
        tx as never,
        event
      )
    ).rejects.toThrow("connection reset");
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
