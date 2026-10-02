/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../duration/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/duration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/duration", () => {
  it("parses a time-only ISO 8601 duration", async () => {
    const res = await POST(makeReq({ mode: "parse", text: "PT1H30M5S" }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.components).toEqual({
      years: 0,
      months: 0,
      weeks: 0,
      days: 0,
      hours: 1,
      minutes: 30,
      seconds: 5,
    });
    expect(data.total_seconds).toBe(5405);
  });

  it("round-trips a combined date and time duration", async () => {
    const parseRes = await POST(
      makeReq({ mode: "parse", text: "P1Y2M3W4DT5H6M7S" })
    );
    expect(parseRes.status).toBe(200);
    const parsed = await parseRes.json();

    expect(parsed.components).toEqual({
      years: 1,
      months: 2,
      weeks: 3,
      days: 4,
      hours: 5,
      minutes: 6,
      seconds: 7,
    });

    const formatRes = await POST(
      makeReq({ mode: "format", components: parsed.components })
    );
    expect(formatRes.status).toBe(200);
    const formatted = await formatRes.json();

    expect(formatted.text).toBe("P1Y2M3W4DT5H6M7S");
    expect(formatted.total_seconds).toBe(1 * 31536000 + 2 * 2592000 + 3 * 604800 + 4 * 86400 + 5 * 3600 + 6 * 60 + 7);

    const roundTripRes = await POST(makeReq({ mode: "parse", text: formatted.text }));
    expect(roundTripRes.status).toBe(200);
    const roundTrip = await roundTripRes.json();
    expect(roundTrip.components).toEqual(parsed.components);
  });

  it("formats zero duration as PT0S", async () => {
    const res = await POST(makeReq({ mode: "format", components: {} }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.text).toBe("PT0S");
    expect(data.total_seconds).toBe(0);
  });
});
