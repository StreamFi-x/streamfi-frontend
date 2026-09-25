/**
 * @jest-environment node
 *
 * Mux API reads used by the reconciliation job: pagination, response-shape
 * validation and error propagation.
 */

const mockList = jest.fn();
const mockRetrieve = jest.fn();

jest.mock("@mux/mux-node", () => {
  class NotFoundError extends Error {}
  function Mux() {
    // Wrapped so the mocks are read at call time, not at module load.
    return {
      video: {
        liveStreams: {
          list: (...args: unknown[]) => mockList(...args),
          retrieve: (...args: unknown[]) => mockRetrieve(...args),
        },
      },
    };
  }
  Mux.NotFoundError = NotFoundError;
  return { __esModule: true, default: Mux };
});

import Mux from "@mux/mux-node";
import {
  getMuxLiveStreamStatus,
  listActiveMuxLiveStreamIds,
} from "@/lib/mux/server";

const page = (n: number, offset = 0, status = "active") => ({
  data: Array.from({ length: n }, (_, i) => ({
    id: `s-${offset + i}`,
    status,
  })),
});

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  mockList.mockReset();
  mockRetrieve.mockReset();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe("listActiveMuxLiveStreamIds", () => {
  it("walks every page until a short page and requests only active streams", async () => {
    mockList
      .mockResolvedValueOnce(page(100, 0))
      .mockResolvedValueOnce(page(100, 100))
      .mockResolvedValueOnce(page(7, 200));

    const result = await listActiveMuxLiveStreamIds();

    expect(result.complete).toBe(true);
    expect(result.pages).toBe(3);
    expect(result.ids.size).toBe(207);
    expect(mockList.mock.calls.map(c => c[0])).toEqual([
      { status: "active", limit: 100, page: 1 },
      { status: "active", limit: 100, page: 2 },
      { status: "active", limit: 100, page: 3 },
    ]);
    expect(mockList.mock.calls[0][1]).toMatchObject({ timeout: 10_000 });
  });

  it("reports an incomplete listing when the page cap is reached", async () => {
    let offset = 0;
    mockList.mockImplementation(async () => page(100, (offset += 100)));
    const result = await listActiveMuxLiveStreamIds();
    expect(result).toMatchObject({ complete: false, pages: 50 });
  });

  it("ignores entries that are not active", async () => {
    mockList.mockResolvedValueOnce({
      data: [
        { id: "a", status: "active" },
        { id: "b", status: "idle" },
      ],
    });
    const result = await listActiveMuxLiveStreamIds();
    expect([...result.ids]).toEqual(["a"]);
  });

  it("throws on an unexpected response shape instead of returning an empty set", async () => {
    mockList.mockResolvedValueOnce({ data: null });
    await expect(listActiveMuxLiveStreamIds()).rejects.toThrow(/shape/);
    mockList.mockResolvedValueOnce({ data: [{ status: "active" }] });
    await expect(listActiveMuxLiveStreamIds()).rejects.toThrow(/shape/);
  });

  it("propagates API failures mid-pagination", async () => {
    mockList
      .mockResolvedValueOnce(page(100))
      .mockRejectedValueOnce(new Error("503 from Mux"));
    await expect(listActiveMuxLiveStreamIds()).rejects.toThrow("503 from Mux");
  });
});

describe("getMuxLiveStreamStatus", () => {
  it("returns the stream status", async () => {
    mockRetrieve.mockResolvedValueOnce({ id: "s", status: "idle" });
    await expect(getMuxLiveStreamStatus("s")).resolves.toBe("idle");
  });

  it("maps 404 to not_found but rethrows other errors", async () => {
    const NotFound = (Mux as unknown as { NotFoundError: new () => Error })
      .NotFoundError;
    mockRetrieve.mockRejectedValueOnce(new NotFound());
    await expect(getMuxLiveStreamStatus("gone")).resolves.toBe("not_found");
    mockRetrieve.mockRejectedValueOnce(new Error("timeout"));
    await expect(getMuxLiveStreamStatus("s")).rejects.toThrow("timeout");
  });
});
