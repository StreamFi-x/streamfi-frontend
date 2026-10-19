/**
 * Tests for diagnostics API route
 */

import { POST } from "@/app/api/streams/diagnostics/route";
import { NextRequest } from "next/server";

// Mock verifySession
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

// Mock diagnostics service
jest.mock("@/lib/diagnostics/service", () => ({
  runDiagnostics: jest.fn().mockResolvedValue({
    bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
    frames: { total: 100, dropped: 0, dropRate: 0 },
    keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
    networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
    health: { status: "good", confidence: 0.95 },
    timestamp: new Date().toISOString(),
  }),
}));

// Mock guidance generator
jest.mock("@/lib/diagnostics/guidance-generator", () => ({
  generateGuidance: jest.fn().mockReturnValue({
    guidance: [
      { message: "Your stream is ready", severity: "info" },
    ],
    summary: "All systems go!",
  }),
}));

// Mock logger
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { verifySession } = require("@/lib/auth/verify-session");
const { runDiagnostics } = require("@/lib/diagnostics/service");
const { generateGuidance } = require("@/lib/diagnostics/guidance-generator");
const { logger } = require("@/lib/tracing/logger");

describe("POST /api/streams/diagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySession.mockResolvedValue({
      ok: true,
      userId: "user-123",
      wallet: "0x123",
      username: "testuser",
    });
  });

  describe("authentication", () => {
    it("returns 401 if not authenticated", async () => {
      verifySession.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });

      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("accepts valid encoder settings", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("rejects invalid bitrate (non-positive)", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 0,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("rejects invalid bitrate (too high)", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 200000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("rejects invalid resolution format", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "invalid",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("rejects invalid keyframe interval (non-positive)", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 0,
          },
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("accepts different valid resolutions", async () => {
      const resolutions = ["1280x720", "1920x1080", "3840x2160"];

      for (const resolution of resolutions) {
        const req = new NextRequest("http://localhost/api/streams/diagnostics", {
          method: "POST",
          body: JSON.stringify({
            encoderSettings: {
              bitrate: 5000,
              resolution,
              keyframeIntervalMs: 2000,
            },
          }),
        });

        const response = await POST(req);
        expect(response.status).toBe(200);
      }
    });
  });

  describe("rate limiting", () => {
    it("allows first request", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("blocks second request within rate limit window", async () => {
      const req1 = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response1 = await POST(req1);
      expect(response1.status).toBe(200);

      const req2 = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 6000,
            resolution: "1280x720",
            keyframeIntervalMs: 3000,
          },
        }),
      });

      const response2 = await POST(req2);
      expect(response2.status).toBe(429);

      const data = await response2.json();
      expect(data.success).toBe(false);
    });

    it("separates rate limits per user", async () => {
      const req1 = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response1 = await POST(req1);
      expect(response1.status).toBe(200);

      // Change user
      verifySession.mockResolvedValue({
        ok: true,
        userId: "user-456",
        wallet: "0x456",
        username: "otheruser",
      });

      const req2 = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 6000,
            resolution: "1280x720",
            keyframeIntervalMs: 3000,
          },
        }),
      });

      const response2 = await POST(req2);
      expect(response2.status).toBe(200);
    });
  });

  describe("response format", () => {
    it("returns complete diagnostic response", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("results");
      expect(data).toHaveProperty("guidance");
      expect(data).toHaveProperty("summary");
      expect(data).toHaveProperty("timestamp");
    });

    it("includes guidance array", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(Array.isArray(data.guidance)).toBe(true);
      expect(data.guidance.length).toBeGreaterThan(0);
    });

    it("returns ISO timestamp", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("error handling", () => {
    it("gracefully handles diagnostics service errors", async () => {
      runDiagnostics.mockRejectedValueOnce(new Error("Service error"));

      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(200); // Still 200, not 500

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.guidance[0].severity).toBe("warning");
    });

    it("handles malformed JSON", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(req);
      expect(response.status).toBe(200); // Graceful fallback

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe("calls correct downstream services", () => {
    it("calls runDiagnostics with correct parameters", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      await POST(req);

      expect(runDiagnostics).toHaveBeenCalledWith(
        {
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        },
        "user-123"
      );
    });

    it("calls generateGuidance with diagnostic results", async () => {
      const req = new NextRequest("http://localhost/api/streams/diagnostics", {
        method: "POST",
        body: JSON.stringify({
          encoderSettings: {
            bitrate: 5000,
            resolution: "1920x1080",
            keyframeIntervalMs: 2000,
          },
        }),
      });

      await POST(req);

      expect(generateGuidance).toHaveBeenCalled();
    });
  });
});
