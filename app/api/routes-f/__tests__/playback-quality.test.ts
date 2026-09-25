/**
 * @jest-environment node
 *
 * Tests for GET /api/routes-f/playback-quality
 *
 * Covers:
 *   - Validation: missing playback_id → 400
 *   - Happy path: returns options array + default field
 *   - Response shape: each rendition has label, resolution, bandwidth_kbps
 *   - Default rendition logic:
 *       wifi              → "1080p"
 *       cellular / 4g     → "720p"
 *       3g                → "480p"
 *       2g                → "360p"
 *       slow-2g           → "160p"
 *       no hint           → "Auto"
 *       unknown hint      → "Auto" (fallback)
 *   - "Auto" rendition is always present in options
 *   - bandwidth_kbps for "Auto" is 0 (adaptive)
 *   - playback_id does not affect the options or default (renditions are per-platform, not per-stream)
 */

import { NextRequest } from "next/server";
import { GET } from "../playback-quality/route";
import { ALL_RENDITIONS } from "../playback-quality/renditions";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeGet(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/playback-quality");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/playback-quality — validation", () => {
  it("returns 400 when playback_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when playback_id is an empty string", async () => {
    const res = await GET(makeGet({ playback_id: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Happy path — response shape
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/playback-quality — response shape", () => {
  it("returns 200 with options array and default field", async () => {
    const res = await GET(makeGet({ playback_id: "pb-abc123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.options)).toBe(true);
    expect(body.options.length).toBeGreaterThan(0);
    expect(typeof body.default).toBe("string");
  });

  it("each rendition has label, resolution, and bandwidth_kbps", async () => {
    const res = await GET(makeGet({ playback_id: "pb-abc123" }));
    const { options } = await res.json();
    for (const opt of options) {
      expect(typeof opt.label).toBe("string");
      expect(opt.label.length).toBeGreaterThan(0);
      expect(typeof opt.resolution).toBe("string");
      expect(opt.resolution.length).toBeGreaterThan(0);
      expect(typeof opt.bandwidth_kbps).toBe("number");
      expect(opt.bandwidth_kbps).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns all expected rendition labels", async () => {
    const res = await GET(makeGet({ playback_id: "pb-abc123" }));
    const { options } = await res.json();
    const labels: string[] = options.map((o: { label: string }) => o.label);
    expect(labels).toContain("1080p");
    expect(labels).toContain("720p");
    expect(labels).toContain("480p");
    expect(labels).toContain("360p");
    expect(labels).toContain("160p");
    expect(labels).toContain("Auto");
  });

  it("options count matches the catalog", async () => {
    const res = await GET(makeGet({ playback_id: "pb-abc123" }));
    const { options } = await res.json();
    expect(options.length).toBe(ALL_RENDITIONS.length);
  });

  it("Auto rendition has bandwidth_kbps of 0", async () => {
    const res = await GET(makeGet({ playback_id: "pb-abc123" }));
    const { options } = await res.json();
    const auto = options.find((o: { label: string }) => o.label === "Auto");
    expect(auto).toBeDefined();
    expect(auto.bandwidth_kbps).toBe(0);
    expect(auto.resolution).toBe("adaptive");
  });

  it("different playback_ids return the same options catalog", async () => {
    const r1 = await GET(makeGet({ playback_id: "pb-111" }));
    const r2 = await GET(makeGet({ playback_id: "pb-999" }));
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1.options).toEqual(b2.options);
  });
});

// ---------------------------------------------------------------------------
// Default rendition — connection_type hint
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/playback-quality — default rendition (wifi)", () => {
  it("wifi → default is 1080p", async () => {
    const res = await GET(makeGet({ playback_id: "pb-1", connection_type: "wifi" }));
    const { default: def } = await res.json();
    expect(def).toBe("1080p");
  });
});

describe("GET /api/routes-f/playback-quality — default rendition (cellular)", () => {
  it("cellular → default is 720p", async () => {
    const res = await GET(makeGet({ playback_id: "pb-1", connection_type: "cellular" }));
    const { default: def } = await res.json();
    expect(def).toBe("720p");
  });

  it("4g → default is 720p", async () => {
    const res = await GET(makeGet({ playback_id: "pb-1", connection_type: "4g" }));
    const { default: def } = await res.json();
    expect(def).toBe("720p");
  });
});

describe("GET /api/routes-f/playback-quality — default rendition (degraded connections)", () => {
  it("3g → default is 480p", async () => {
    const res = await GET(makeGet({ playback_id: "pb-1", connection_type: "3g" }));
    const { default: def } = await res.json();
    expect(def).toBe("480p");
  });

  it("2g → default is 360p", async () => {
    const res = await GET(makeGet({ playback_id: "pb-1", connection_type: "2g" }));
    const { default: def } = await res.json();
    expect(def).toBe("360p");
  });

  it("slow-2g → default is 160p", async () => {
    const res = await GET(makeGet({ playback_id: "pb-1", connection_type: "slow-2g" }));
    const { default: def } = await res.json();
    expect(def).toBe("160p");
  });
});

describe("GET /api/routes-f/playback-quality — default rendition (no hint / unknown)", () => {
  it("no connection_type → default is Auto", async () => {
    const res = await GET(makeGet({ playback_id: "pb-1" }));
    const { default: def } = await res.json();
    expect(def).toBe("Auto");
  });

  it("unknown connection_type → fallback to Auto", async () => {
    const res = await GET(makeGet({ playback_id: "pb-1", connection_type: "lte-advanced" }));
    const { default: def } = await res.json();
    expect(def).toBe("Auto");
  });
});

// ---------------------------------------------------------------------------
// Default label must exist in options
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/playback-quality — default label is always in options", () => {
  const hints = ["wifi", "cellular", "4g", "3g", "2g", "slow-2g", "unknown-type"];

  for (const hint of hints) {
    it(`default label exists in options for connection_type="${hint}"`, async () => {
      const res = await GET(makeGet({ playback_id: "pb-x", connection_type: hint }));
      const { options, default: def } = await res.json();
      const labels: string[] = options.map((o: { label: string }) => o.label);
      expect(labels).toContain(def);
    });
  }

  it("default label exists in options when no hint provided", async () => {
    const res = await GET(makeGet({ playback_id: "pb-x" }));
    const { options, default: def } = await res.json();
    const labels: string[] = options.map((o: { label: string }) => o.label);
    expect(labels).toContain(def);
  });
});
