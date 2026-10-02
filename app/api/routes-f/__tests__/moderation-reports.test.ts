/**
 * @jest-environment node
 *
 * Tests for GET /api/routes-f/moderation-reports
 *
 * Seed summary:
 *   creator_001 — 6 reports: 4 open, 2 resolved
 *   creator_002 — 3 reports: 1 open, 2 resolved
 */

import { NextRequest } from "next/server";
import { GET } from "../moderation-reports/route";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeGet(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/moderation-reports");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/moderation-reports — validation", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when creator_id is an empty string", async () => {
    const res = await GET(makeGet({ creator_id: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is an invalid value", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_001", status: "pending" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is 0", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_001", limit: "0" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit exceeds 100", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_001", limit: "101" })
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/moderation-reports — not found", () => {
  it("returns 404 for an unknown creator_id", async () => {
    const res = await GET(makeGet({ creator_id: "creator_unknown" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// creator_001 — no status filter
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/moderation-reports — creator_001 (all statuses)", () => {
  it("returns 200 with all 6 reports", async () => {
    const res = await GET(makeGet({ creator_id: "creator_001" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(6);
    expect(body.reports).toHaveLength(6);
  });

  it("reports are sorted newest first", async () => {
    const res = await GET(makeGet({ creator_id: "creator_001" }));
    const { reports } = await res.json();
    const dates = reports.map((r: { created_at: string }) =>
      new Date(r.created_at).getTime()
    );
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  it("each report has all required fields", async () => {
    const res = await GET(makeGet({ creator_id: "creator_001" }));
    const { reports } = await res.json();
    for (const r of reports) {
      expect(typeof r.id).toBe("string");
      expect(["user", "stream"]).toContain(r.target_type);
      expect(typeof r.target_id).toBe("string");
      expect(typeof r.reporter_id).toBe("string");
      expect(typeof r.reason).toBe("string");
      expect(typeof r.created_at).toBe("string");
      expect(["open", "resolved"]).toContain(r.status);
    }
  });

  it("response does not expose creator_id on report objects", async () => {
    const res = await GET(makeGet({ creator_id: "creator_001" }));
    const { reports } = await res.json();
    for (const r of reports) {
      expect(r).not.toHaveProperty("creator_id");
    }
  });
});

// ---------------------------------------------------------------------------
// creator_001 — filter by status=open
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/moderation-reports — creator_001 status=open", () => {
  it("returns only open reports", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_001", status: "open" })
    );
    expect(res.status).toBe(200);
    const { reports, total } = await res.json();
    expect(total).toBe(4);
    expect(reports).toHaveLength(4);
    for (const r of reports) {
      expect(r.status).toBe("open");
    }
  });
});

// ---------------------------------------------------------------------------
// creator_001 — filter by status=resolved
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/moderation-reports — creator_001 status=resolved", () => {
  it("returns only resolved reports", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_001", status: "resolved" })
    );
    expect(res.status).toBe(200);
    const { reports, total } = await res.json();
    expect(total).toBe(2);
    expect(reports).toHaveLength(2);
    for (const r of reports) {
      expect(r.status).toBe("resolved");
    }
  });
});

// ---------------------------------------------------------------------------
// creator_002
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/moderation-reports — creator_002", () => {
  it("returns all 3 reports with no status filter", async () => {
    const res = await GET(makeGet({ creator_id: "creator_002" }));
    expect(res.status).toBe(200);
    const { reports, total } = await res.json();
    expect(total).toBe(3);
    expect(reports).toHaveLength(3);
  });

  it("status=open returns 1 report for creator_002", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_002", status: "open" })
    );
    const { reports, total } = await res.json();
    expect(total).toBe(1);
    expect(reports).toHaveLength(1);
    expect(reports[0].status).toBe("open");
  });

  it("status=resolved returns 2 reports for creator_002", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_002", status: "resolved" })
    );
    const { reports, total } = await res.json();
    expect(total).toBe(2);
    expect(reports).toHaveLength(2);
    for (const r of reports) {
      expect(r.status).toBe("resolved");
    }
  });
});

// ---------------------------------------------------------------------------
// limit param
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/moderation-reports — limit param", () => {
  it("limit=2 returns 2 reports but total reflects full filtered count", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_001", limit: "2" })
    );
    expect(res.status).toBe(200);
    const { reports, total } = await res.json();
    expect(reports).toHaveLength(2);
    expect(total).toBe(6); // total is pre-limit count
  });

  it("limit=1 with status=open returns 1 report, total=4", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_001", status: "open", limit: "1" })
    );
    const { reports, total } = await res.json();
    expect(reports).toHaveLength(1);
    expect(total).toBe(4);
  });

  it("limit larger than result count returns all reports", async () => {
    const res = await GET(
      makeGet({ creator_id: "creator_002", limit: "50" })
    );
    const { reports, total } = await res.json();
    expect(reports).toHaveLength(3);
    expect(total).toBe(3);
  });
});
