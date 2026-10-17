/**
 * @jest-environment node
 */

import { getMuxAsset } from "@/lib/mux/server";

jest.mock("@mux/mux-node", () => {
  return jest.fn().mockImplementation(() => ({
    video: {
      assets: {
        retrieve: jest.fn().mockResolvedValue({
          id: "asset-err-123",
          status: "errored",
          duration: null,
          playback_ids: [],
          created_at: "2026-10-17T00:00:00Z",
          errors: {
            type: "transcode_error",
            messages: ["Unsupported video codec or corrupted container"],
          },
        }),
      },
      liveStreams: {
        create: jest.fn(),
        retrieve: jest.fn(),
        disable: jest.fn(),
        enable: jest.fn(),
      },
    },
  }));
});

describe("Mux asset error status handling (#786)", () => {
  it("recognizes errored asset status and returns error details", async () => {
    const asset = await getMuxAsset("asset-err-123");

    expect(asset.id).toBe("asset-err-123");
    expect(asset.status).toBe("errored");
    expect(asset.isErrored).toBe(true);
    expect(asset.errors).toEqual({
      type: "transcode_error",
      messages: ["Unsupported video codec or corrupted container"],
    });
  });
});
