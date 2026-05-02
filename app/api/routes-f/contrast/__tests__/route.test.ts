import { NextRequest } from "next/server";
import { POST } from "../route";
function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/contrast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("POST /api/routes-f/contrast", () => {
  it("matches WCAG reference ratio for black/white", async () => {
    const res = await POST(
      makeReq({ foreground: "#000000", background: "#ffffff" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ratio).toBe(21);
    expect(body.levels).toEqual({
      aa_normal: true,
      aa_large: true,
      aaa_normal: true,
      aaa_large: true,
    });
  });
  it("supports rgb() input", async () => {
    const res = await POST(
      makeReq({ foreground: "rgb(255, 255, 255)", background: "rgb(0, 0, 0)" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ratio).toBe(21);
  });
  it("evaluates all WCAG levels for known failing pair", async () => {
    const res = await POST(
      makeReq({ foreground: "#777777", background: "#ffffff" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.levels.aa_normal).toBe(false);
    expect(body.levels.aa_large).toBe(true);
    expect(body.levels.aaa_normal).toBe(false);
    expect(body.levels.aaa_large).toBe(false);
  });
  it("rejects invalid color strings", async () => {
    const res = await POST(
      makeReq({ foreground: "nope", background: "#ffffff" })
    );
    expect(res.status).toBe(400);
  });
});
