import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/stream-mic-check", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Stream Mic-Check API", () => {
  it("assesses a healthy signal as ok", async () => {
    const res = await POST(
      makeReq({ creator_id: "c001", sample_rms_db: -20, peak_db: -6 })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.assessment).toBe("ok");
    expect(Array.isArray(data.suggestions)).toBe(true);
    expect(data.suggestions.length).toBeGreaterThan(0);
  });

  it("assesses a quiet signal as too_low with gain suggestions", async () => {
    const res = await POST(
      makeReq({ creator_id: "c001", sample_rms_db: -45, peak_db: -30 })
    );
    const data = await res.json();

    expect(data.assessment).toBe("too_low");
    expect(data.suggestions.join(" ")).toMatch(/gain|closer/i);
  });

  it("assesses a hot average level as too_high", async () => {
    const res = await POST(
      makeReq({ creator_id: "c001", sample_rms_db: -8, peak_db: -4 })
    );
    const data = await res.json();

    expect(data.assessment).toBe("too_high");
    expect(data.suggestions.join(" ")).toMatch(/lower|limiter|clipping/i);
  });

  it("flags clipping peaks as too_high even when the average is quiet", async () => {
    const res = await POST(
      makeReq({ creator_id: "c001", sample_rms_db: -35, peak_db: -1 })
    );
    const data = await res.json();

    expect(data.assessment).toBe("too_high");
  });

  it("treats boundary values as within range", async () => {
    // RMS exactly at both bounds and peak exactly at the clip threshold are ok.
    for (const body of [
      { creator_id: "c001", sample_rms_db: -30, peak_db: -3 },
      { creator_id: "c001", sample_rms_db: -12, peak_db: -3 },
    ]) {
      const res = await POST(makeReq(body));
      const data = await res.json();
      expect(data.assessment).toBe("ok");
    }
  });

  it("returns 400 when fields are missing or wrong type", async () => {
    const bad = [
      { sample_rms_db: -20, peak_db: -6 }, // no creator_id
      { creator_id: "c001", peak_db: -6 }, // no rms
      { creator_id: "c001", sample_rms_db: "loud", peak_db: -6 }, // wrong type
    ];
    for (const body of bad) {
      const res = await POST(makeReq(body));
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 for a malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routesF/stream-mic-check", {
      method: "POST",
      body: "]not json[",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
