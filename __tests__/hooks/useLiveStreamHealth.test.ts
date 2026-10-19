import { renderHook, waitFor } from "@testing-library/react";
import { useLiveStreamHealth } from "@/hooks/useLiveStreamHealth";

// Mock fetch
global.fetch = jest.fn();

describe("useLiveStreamHealth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("should have initial state when stream is not live", () => {
    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", false)
    );

    expect(result.current.healthStatus).toBe("unavailable");
    expect(result.current.alertLevel).toBe("none");
    expect(result.current.isDataAvailable).toBe(false);
    expect(result.current.lastCheckedAt).toBeNull();
    expect(result.current.readings).toHaveLength(0);
  });

  it("should fetch health data immediately on mount when isLive=true", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: true,
        status: "active",
        reconnectWindow: 60,
        latencyMode: "low",
      }),
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    await waitFor(() => {
      expect(result.current.lastCheckedAt).not.toBeNull();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/streams/health?streamId=stream-123"
    );
    expect(result.current.healthStatus).toBe("good");
    expect(result.current.alertLevel).toBe("none");
    expect(result.current.isDataAvailable).toBe(true);
    expect(result.current.readings).toHaveLength(1);
  });

  it("should detect warning alert level with 2 of 3 bad readings", async () => {
    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => {
          if (callCount === 1 || callCount === 2) {
            // First two calls are bad (not active)
            return {
              streamId: "stream-123",
              isActive: false,
              status: "idle",
              reconnectWindow: null,
            };
          }
          // Third call is good
          return {
            streamId: "stream-123",
            isActive: true,
            status: "active",
            reconnectWindow: 60,
          };
        },
      };
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    // First poll
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });

    // Trigger second poll
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(2);
    });

    expect(result.current.alertLevel).toBe("warning");
    expect(result.current.healthStatus).toBe("degraded");

    // Trigger third poll
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(3);
    });

    // Now we have 2 bad, 1 good → still warning
    expect(result.current.alertLevel).toBe("warning");
  });

  it("should detect critical alert level with 3 bad readings", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: false,
        status: "idle",
        reconnectWindow: null,
      }),
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    // First poll
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });

    // Second poll
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(2);
    });

    // Third poll
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(3);
    });

    expect(result.current.alertLevel).toBe("critical");
    expect(result.current.healthStatus).toBe("degraded");
  });

  it("should be healthy when all 3 readings are good", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: true,
        status: "active",
        reconnectWindow: 60,
      }),
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    // First poll
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });

    // Second poll
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(2);
    });

    // Third poll
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(3);
    });

    expect(result.current.alertLevel).toBe("none");
    expect(result.current.healthStatus).toBe("good");
  });

  it("should set isDataAvailable=false after 3 consecutive fetch failures", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(
      new Error("Network error")
    );

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    // First failure
    await waitFor(() => {
      expect(result.current.isDataAvailable).toBe(false);
    });

    // Second failure
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.isDataAvailable).toBe(false);
    });

    // Third failure
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.isDataAvailable).toBe(false);
    });

    expect(result.current.healthStatus).toBe("unavailable");
    expect(result.current.alertLevel).toBe("none");
  });

  it("should stop polling when isLive goes false", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: true,
        status: "active",
        reconnectWindow: 60,
      }),
    });

    const { result, rerender } = renderHook(
      ({ isLive }) => useLiveStreamHealth("stream-123", isLive),
      { initialProps: { isLive: true } }
    );

    // First poll
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Stop the stream
    rerender({ isLive: false });
    jest.advanceTimersByTime(15_000);

    // Should not poll again
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.readings).toHaveLength(0);
    expect(result.current.healthStatus).toBe("unavailable");
  });

  it("should identify mux-side cause when status is idle", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: true,
        status: "idle",
        reconnectWindow: 60,
      }),
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });

    expect(result.current.likelyCause).toBe("mux-side");
  });

  it("should identify encoder cause when isActive=true and reconnectWindow<=10", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: true,
        status: "active",
        reconnectWindow: 5,
      }),
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });

    expect(result.current.likelyCause).toBe("encoder");
  });

  it("should identify upload cause when isActive=false and reconnectWindow>=10", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: false,
        status: "idle",
        reconnectWindow: 60,
      }),
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });

    expect(result.current.likelyCause).toBe("upload");
  });

  it("should maintain circular buffer of exactly 3 readings", async () => {
    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          streamId: "stream-123",
          isActive: true,
          status: "active",
          reconnectWindow: callCount,
        }),
      };
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    // First poll
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });
    expect(result.current.readings[0].reconnectWindow).toBe(1);

    // Second poll
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(2);
    });
    expect(result.current.readings[1].reconnectWindow).toBe(2);

    // Third poll
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(3);
    });
    expect(result.current.readings[2].reconnectWindow).toBe(3);

    // Fourth poll - should evict first
    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(result.current.readings).toHaveLength(3);
    });
    expect(result.current.readings[0].reconnectWindow).toBe(2);
    expect(result.current.readings[1].reconnectWindow).toBe(3);
    expect(result.current.readings[2].reconnectWindow).toBe(4);
  });

  it("should update lastCheckedAt on each successful poll", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: true,
        status: "active",
        reconnectWindow: 60,
      }),
    });

    const { result } = renderHook(() =>
      useLiveStreamHealth("stream-123", true)
    );

    const firstTime = new Date();
    jest.setSystemTime(firstTime);

    await waitFor(() => {
      expect(result.current.lastCheckedAt).not.toBeNull();
    });

    const secondTime = new Date(firstTime.getTime() + 15_000);
    jest.setSystemTime(secondTime);
    jest.advanceTimersByTime(15_000);

    await waitFor(() => {
      expect(result.current.lastCheckedAt?.getTime()).toBe(secondTime.getTime());
    });
  });

  it("should reset state when streamId becomes null", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        streamId: "stream-123",
        isActive: true,
        status: "active",
        reconnectWindow: 60,
      }),
    });

    const { result, rerender } = renderHook(
      ({ streamId, isLive }) => useLiveStreamHealth(streamId, isLive),
      { initialProps: { streamId: "stream-123", isLive: true } }
    );

    await waitFor(() => {
      expect(result.current.readings).toHaveLength(1);
    });

    rerender({ streamId: null, isLive: true });

    expect(result.current.readings).toHaveLength(0);
    expect(result.current.lastCheckedAt).toBeNull();
    expect(result.current.isDataAvailable).toBe(false);
    expect(result.current.healthStatus).toBe("unavailable");
  });
});
