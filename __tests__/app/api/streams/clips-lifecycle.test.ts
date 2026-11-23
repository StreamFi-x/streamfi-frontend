/**
 * @jest-environment node
 *
 * Stream Clips Lifecycle & Webhook Tests (#1840)
 */

import { assetHandlers, assetDeletedHandler } from "@/lib/mux/webhook-handlers";

describe("Stream Clips Webhook Lifecycle (#1840)", () => {
  it("transitions stream_clips from processing to ready on video.asset.ready", async () => {
    const mockSql = jest.fn();
    const tx = { sql: mockSql } as any;

    // First call: check stream_clips
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "clip-uuid-1", streamer_id: "user-1" }],
      rowCount: 1,
    });
    // Second call: update stream_clips
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const handlers = assetHandlers({ notifyOwner: false });
    const event = {
      id: "evt-123",
      type: "video.asset.ready",
      data: {
        id: "mux-asset-clip-99",
        playback_ids: [{ id: "pb-clip-99" }],
        duration: 30,
      },
    };

    await handlers["video.asset.ready"](tx, event as any);

    expect(mockSql).toHaveBeenCalledTimes(2);
    expect(mockSql.mock.calls[0][0].join("")).toContain("SELECT id, streamer_id FROM stream_clips");
    expect(mockSql.mock.calls[1][0].join("")).toContain("UPDATE stream_clips SET");
    expect(mockSql.mock.calls[1][0].join("")).toContain("status = 'ready'");
  });

  it("updates stream_clips status to error on video.asset.errored", async () => {
    const mockSql = jest.fn();
    const tx = { sql: mockSql } as any;

    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const handlers = assetHandlers({ notifyOwner: false });
    const event = {
      id: "evt-124",
      type: "video.asset.errored",
      data: {
        id: "mux-asset-clip-99",
      },
    };

    await handlers["video.asset.errored"](tx, event as any);

    expect(mockSql).toHaveBeenCalled();
    expect(mockSql.mock.calls[0][0][0]).toContain("UPDATE stream_clips SET status = 'error'");
  });

  it("deletes clip from stream_clips on assetDeletedHandler", async () => {
    const mockSql = jest.fn();
    const tx = { sql: mockSql } as any;

    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const event = {
      id: "evt-125",
      type: "video.asset.deleted",
      data: {
        id: "mux-asset-clip-99",
      },
    };

    await assetDeletedHandler(tx, event as any);

    expect(mockSql).toHaveBeenCalledTimes(2);
    expect(mockSql.mock.calls[1][0][0]).toContain("DELETE FROM stream_clips WHERE mux_asset_id =");
  });
});
