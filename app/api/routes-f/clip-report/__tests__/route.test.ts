import { NextRequest } from "next/server";
import { POST, GET } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/clip-report", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGet(clipId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/clip-report?clip_id=${encodeURIComponent(
      clipId
    )}`
  );
}

describe("POST /api/routes-f/clip-report", () => {
  it("submits a report and returns a report_id", async () => {
    const res = await POST(
      makePost({
        clip_id: "clip_fresh_1",
        reporter_id: "viewer_fresh_1",
        reason: "spam",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.report_id).toBe("string");
  });

  it("accepts an optional description", async () => {
    const res = await POST(
      makePost({
        clip_id: "clip_fresh_2",
        reporter_id: "viewer_fresh_2",
        reason: "other",
        description: "Something looks off",
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when reason is invalid", async () => {
    const res = await POST(
      makePost({
        clip_id: "clip_fresh_3",
        reporter_id: "viewer_fresh_3",
        reason: "not-a-real-reason",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when clip_id is missing", async () => {
    const res = await POST(
      makePost({ reporter_id: "viewer_fresh_4", reason: "spam" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when reporter_id is missing", async () => {
    const res = await POST(
      makePost({ clip_id: "clip_fresh_5", reason: "spam" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/clip-report",
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rate limits after 5 reports from the same viewer within 15 minutes", async () => {
    const reporterId = "viewer_rate_limited";
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        makePost({
          clip_id: `clip_rl_${i}`,
          reporter_id: reporterId,
          reason: "spam",
        })
      );
      expect(res.status).toBe(200);
    }

    const sixth = await POST(
      makePost({
        clip_id: "clip_rl_6",
        reporter_id: reporterId,
        reason: "spam",
      })
    );
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get("Retry-After")).toBe("900");
  });

  it("does not rate limit a different viewer", async () => {
    const busyReporter = "viewer_rate_limited_2";
    for (let i = 0; i < 5; i++) {
      await POST(
        makePost({
          clip_id: `clip_rl2_${i}`,
          reporter_id: busyReporter,
          reason: "spam",
        })
      );
    }

    const otherViewer = await POST(
      makePost({
        clip_id: "clip_rl2_other",
        reporter_id: "viewer_unrelated",
        reason: "spam",
      })
    );
    expect(otherViewer.status).toBe(200);
  });
});

describe("GET /api/routes-f/clip-report", () => {
  it("returns the seeded active report count for a clip", async () => {
    const res = await GET(makeGet("clip_with_reports"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clip_id).toBe("clip_with_reports");
    // Two active seed reports; the third seed report is dismissed.
    expect(body.active_reports).toBe(2);
  });

  it("returns 0 for a clip with no reports", async () => {
    const res = await GET(makeGet("clip_never_reported"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active_reports).toBe(0);
  });

  it("returns 400 when clip_id is missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/routes-f/clip-report")
    );
    expect(res.status).toBe(400);
  });

  it("reflects a freshly submitted report in the count", async () => {
    await POST(
      makePost({
        clip_id: "clip_count_check",
        reporter_id: "viewer_count_check",
        reason: "copyright",
      })
    );
    const res = await GET(makeGet("clip_count_check"));
    const body = await res.json();
    expect(body.active_reports).toBe(1);
  });
});
