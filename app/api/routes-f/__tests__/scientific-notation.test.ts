/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../scientific-notation/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/scientific-notation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/scientific-notation", () => {
  it("formats large numbers in scientific notation", async () => {
    const res = await POST(makeReq({ mode: "format", value: 1230000, sig_figs: 3 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe("1.23e6");
  });

  it("parses scientific notation back to a number", async () => {
    const res = await POST(makeReq({ mode: "parse", value: "1.23e6" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe(1230000);
  });

  it("formats small magnitudes", async () => {
    const res = await POST(makeReq({ mode: "format", value: 0.0000012, sig_figs: 2 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe("1.2e-6");
  });

  it("formats and parses negative engineering notation", async () => {
    const formatRes = await POST(
      makeReq({ mode: "format", value: -4560, sig_figs: 3, style: "engineering" })
    );
    expect(formatRes.status).toBe(200);
    const formatted = await formatRes.json();
    expect(formatted.result).toBe("-4.56 k");

    const parseRes = await POST(makeReq({ mode: "parse", value: "-4.56 k", style: "engineering" }));
    expect(parseRes.status).toBe(200);
    const parsed = await parseRes.json();
    expect(parsed.result).toBeCloseTo(-4560);
  });

  it("rejects invalid modes", async () => {
    const res = await POST(makeReq({ mode: "convert", value: 42 }));
    expect(res.status).toBe(400);
  });
});
