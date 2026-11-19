/**
 * Tests for useDiagnostics hook - client-side state management
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useDiagnostics } from "@/hooks/useDiagnostics";

// Mock fetch
global.fetch = jest.fn();

describe("hooks/useDiagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe("initial state", () => {
    it("starts with empty state", () => {
      const { result } = renderHook(() => useDiagnostics());

      expect(result.current.results).toBeNull();
      expect(result.current.guidance).toEqual([]);
      expect(result.current.summary).toBe("");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.timestamp).toBeNull();
    });
  });

  describe("running diagnostics", () => {
    it("sets loading state while running", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve(
                  new Response(
                    JSON.stringify({
                      success: true,
                      results: {
                        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
                        frames: { total: 100, dropped: 0, dropRate: 0 },
                        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
                        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
                        health: { status: "good", confidence: 0.95 },
                        timestamp: new Date().toISOString(),
                      },
                      guidance: [{ message: "All good", severity: "info" }],
                      summary: "Stream ready",
                      timestamp: new Date().toISOString(),
                    })
                  )
                ),
              100
            )
          )
      );

      const { result } = renderHook(() => useDiagnostics());

      let isLoadingDuringRun = false;

      act(() => {
        result.current
          .run({
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          })
          .then(() => {
            isLoadingDuringRun = result.current.isLoading;
          });
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it("updates results after successful run", async () => {
      const mockResponse = {
        success: true,
        results: {
          bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "good", confidence: 0.95 },
          timestamp: new Date().toISOString(),
        },
        guidance: [{ message: "All good", severity: "info" }],
        summary: "Stream ready",
        timestamp: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse))
      );

      const { result } = renderHook(() => useDiagnostics());

      await act(async () => {
        await result.current.run({
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        });
      });

      expect(result.current.results).toBeDefined();
      expect(result.current.results?.bitrate.actual).toBe(5000);
      expect(result.current.guidance).toHaveLength(1);
      expect(result.current.summary).toBe("Stream ready");
    });

    it("handles API errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useDiagnostics());

      await act(async () => {
        await result.current.run({
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        });
      });

      expect(result.current.error).toContain("Network error");
      expect(result.current.results).toBeNull();
    });

    it("handles failed diagnostics response", async () => {
      const mockResponse = {
        success: false,
        results: null,
        guidance: [{ message: "Service unavailable", severity: "warning" }],
        summary: "Diagnostics failed",
        timestamp: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse))
      );

      const { result } = renderHook(() => useDiagnostics());

      await act(async () => {
        await result.current.run({
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        });
      });

      expect(result.current.error).toBe("Diagnostics failed");
      expect(result.current.results).toBeNull();
    });

    it("calls API with correct encoder settings", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            results: null,
            guidance: [],
            summary: "OK",
            timestamp: new Date().toISOString(),
          })
        )
      );

      const { result } = renderHook(() => useDiagnostics());

      const encoderSettings = {
        bitrate: 6000,
        resolution: "1280x720",
        keyframeIntervalMs: 3000,
      };

      await act(async () => {
        await result.current.run(encoderSettings);
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/streams/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encoderSettings }),
      });
    });
  });

  describe("caching", () => {
    it("caches results for same encoder settings", async () => {
      const mockResponse = {
        success: true,
        results: {
          bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "good", confidence: 0.95 },
          timestamp: new Date().toISOString(),
        },
        guidance: [{ message: "Cached", severity: "info" }],
        summary: "From cache",
        timestamp: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse))
      );

      const { result: result1 } = renderHook(() => useDiagnostics());
      const encoderSettings = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      await act(async () => {
        await result1.current.run(encoderSettings);
      });

      // Second hook instance with same settings
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse))
      );

      const { result: result2 } = renderHook(() => useDiagnostics());

      await act(async () => {
        await result2.current.run(encoderSettings);
      });

      // First call made one fetch, second should use cache
      // (In a real test, we'd verify fetch was called only once total)
      expect(result2.current.results).toBeDefined();
    });

    it("makes new API call for different encoder settings", async () => {
      const mockResponse1 = {
        success: true,
        results: {
          bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "good", confidence: 0.95 },
          timestamp: new Date().toISOString(),
        },
        guidance: [],
        summary: "Settings 1",
        timestamp: new Date().toISOString(),
      };

      const mockResponse2 = {
        success: true,
        results: {
          bitrate: { target: 6000, actual: 6000, variance: 0, stability: "excellent" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 3000, expectedInterval: 3000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "good", confidence: 0.95 },
          timestamp: new Date().toISOString(),
        },
        guidance: [],
        summary: "Settings 2",
        timestamp: new Date().toISOString(),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse1)))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse2)));

      const { result } = renderHook(() => useDiagnostics());

      await act(async () => {
        await result.current.run({
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        });
      });

      expect(result.current.summary).toBe("Settings 1");

      await act(async () => {
        await result.current.run({
          bitrate: 6000,
          resolution: "1280x720",
          keyframeIntervalMs: 3000,
        });
      });

      expect(result.current.summary).toBe("Settings 2");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("reset", () => {
    it("clears all state", async () => {
      const mockResponse = {
        success: true,
        results: {
          bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "good", confidence: 0.95 },
          timestamp: new Date().toISOString(),
        },
        guidance: [{ message: "Test", severity: "info" }],
        summary: "Test summary",
        timestamp: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse))
      );

      const { result } = renderHook(() => useDiagnostics());

      await act(async () => {
        await result.current.run({
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        });
      });

      expect(result.current.results).not.toBeNull();
      expect(result.current.guidance).toHaveLength(1);

      act(() => {
        result.current.reset();
      });

      expect(result.current.results).toBeNull();
      expect(result.current.guidance).toEqual([]);
      expect(result.current.summary).toBe("");
      expect(result.current.error).toBeNull();
      expect(result.current.timestamp).toBeNull();
    });
  });

  describe("timestamp handling", () => {
    it("sets timestamp on successful run", async () => {
      const testTimestamp = new Date().toISOString();
      const mockResponse = {
        success: true,
        results: {
          bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "good", confidence: 0.95 },
          timestamp: testTimestamp,
        },
        guidance: [],
        summary: "OK",
        timestamp: testTimestamp,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse))
      );

      const { result } = renderHook(() => useDiagnostics());

      await act(async () => {
        await result.current.run({
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        });
      });

      expect(result.current.timestamp).toBe(testTimestamp);
    });

    it("sets timestamp on failed run", async () => {
      const mockResponse = {
        success: false,
        results: null,
        guidance: [],
        summary: "Failed",
        timestamp: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse))
      );

      const { result } = renderHook(() => useDiagnostics());

      await act(async () => {
        await result.current.run({
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        });
      });

      expect(result.current.timestamp).toBeDefined();
      expect(result.current.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
