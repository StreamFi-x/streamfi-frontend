/**
 * #757: Mux Data gets a real per-viewer pseudonymous id and the stream's title,
 * never a hardcoded "test-user" or a raw wallet address.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { webcrypto } from "crypto";
import { TextEncoder as NodeTextEncoder } from "util";

const mockMuxPlayer = jest.fn((_props: Record<string, unknown>) => (
  <div data-testid="mux-player" />
));
jest.mock("@mux/mux-player-react", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockMuxPlayer(props),
}));

import VideoPlayerMux from "@/components/VideoPlayerMux";
import { getMuxViewerId } from "@/lib/mux/viewer-id";

const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
  (globalThis as any).TextEncoder = NodeTextEncoder;
});

beforeEach(() => {
  mockMuxPlayer.mockClear();
  window.localStorage.clear();
});

function lastMetadata() {
  const calls = mockMuxPlayer.mock.calls;
  return calls[calls.length - 1][0].metadata as Record<string, string>;
}

describe("getMuxViewerId", () => {
  it("is stable, pseudonymous and never the raw identity", async () => {
    const a = await getMuxViewerId(WALLET);
    const b = await getMuxViewerId(WALLET);
    expect(a).toBe(b);
    expect(a).not.toContain(WALLET);
    expect(a).toMatch(/^u-[0-9a-f]{32}$/);
    expect(await getMuxViewerId(`${WALLET}X`)).not.toBe(a);
  });

  it("gives logged-out viewers a persisted random id, distinct per browser", async () => {
    const first = await getMuxViewerId(null);
    expect(first).toMatch(/^anon-/);
    expect(await getMuxViewerId("  ")).toBe(first);
    window.localStorage.clear();
    expect(await getMuxViewerId(undefined)).not.toBe(first);
  });

  it("still returns an id when localStorage throws", async () => {
    const spy = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(await getMuxViewerId(null)).toMatch(/^anon-/);
    spy.mockRestore();
  });
});

describe("VideoPlayerMux metadata", () => {
  it("reports the stream title and a hashed viewer id", async () => {
    render(
      <VideoPlayerMux
        playbackId="pb1"
        title="Speedrun night"
        viewerIdentity={WALLET}
        addLog={jest.fn()}
      />
    );
    await waitFor(() => expect(screen.getByTestId("mux-player")).toBeTruthy());
    const meta = lastMetadata();
    expect(meta.video_title).toBe("Speedrun night");
    expect(meta.viewer_user_id).toBe(await getMuxViewerId(WALLET));
    expect(meta.viewer_user_id).not.toBe("test-user");
    expect(JSON.stringify(meta)).not.toContain(WALLET);
  });

  it("does not mount the player before the viewer id is ready", () => {
    render(<VideoPlayerMux playbackId="pb1" title="t" addLog={jest.fn()} />);
    expect(mockMuxPlayer).not.toHaveBeenCalled();
  });

  it("uses an anonymous id for logged-out viewers", async () => {
    render(<VideoPlayerMux playbackId="pb1" title="t" addLog={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("mux-player")).toBeTruthy());
    expect(lastMetadata().viewer_user_id).toMatch(/^anon-/);
  });
});
