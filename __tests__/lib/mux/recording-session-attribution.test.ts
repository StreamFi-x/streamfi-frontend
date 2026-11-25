/**
 * @jest-environment node
 *
 * Attribution of recordings to stream sessions with time-window correlation (#1866)
 */
import { assetHandlers } from "@/lib/mux/webhook-handlers";

jest.mock("@/lib/mux/recordings", () => ({
  upsertRecordingFromAsset: jest.fn().mockResolvedValue({ id: "rec-123" }),
}));

jest.mock("@/lib/notifications", () => ({
  writeNotification: jest.fn().mockResolvedValue(undefined),
}));

import { upsertRecordingFromAsset } from "@/lib/mux/recordings";

describe("video.asset.ready stream session attribution (#1866)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("attributes recording to stream session with time-window correlation", async () => {
    const handlers = assetHandlers({ notifyOwner: false });
    const readyHandler = handlers["video.asset.ready"];

    const mockSql = jest.fn();
    // 1. user lookup
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: "user-456",
          creator: { streamTitle: "Great Gaming Session" },
        },
      ],
    });
    // 2. session lookup with time-window correlation
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "session-789" }],
    });

    const tx = { sql: mockSql } as any;

    const event = {
      type: "video.asset.ready",
      data: {
        id: "asset-123",
        playback_ids: [{ id: "pb-123" }],
        duration: 3600,
        live_stream_id: "mux-stream-999",
        created_at: 1732380000,
      },
    };

    await readyHandler(tx, event as any);

    // Verify session lookup queried with unattached session priority and time bounds
    expect(mockSql).toHaveBeenCalledTimes(2);
    const sessionQuery = mockSql.mock.calls[1][0].join("");
    expect(sessionQuery).toContain("FROM stream_sessions");
    expect(sessionQuery).toContain("r.id IS NULL");
    expect(sessionQuery).toContain("interval '2 hours'");

    // Verify upsert was called with the correlated streamSessionId
    expect(upsertRecordingFromAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-456",
        streamSessionId: "session-789",
        assetId: "asset-123",
        playbackId: "pb-123",
        title: "Great Gaming Session",
        duration: 3600,
      }),
      tx
    );
  });
});
