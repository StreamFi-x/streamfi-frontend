import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/json-validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/json-validate", () => {
  it("accepts valid object input", async () => {
    const res = await POST(makeReq({ input: '{"a":1,"b":2}' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.parsed).toEqual({ a: 1, b: 2 });
  });

  it("accepts valid array input", async () => {
    const res = await POST(makeReq({ input: "[1,2,3]" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.parsed).toEqual([1, 2, 3]);
  });

  it("returns error with line and column for invalid syntax", async () => {
    const res = await POST(makeReq({ input: '{\n  "a": 1,\n  "b":\n}' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error.line).toBeGreaterThan(0);
    expect(body.error.column).toBeGreaterThan(0);
    expect(typeof body.error.position).toBe("number");
  });

  it("returns formatted output when format=true", async () => {
    const res = await POST(makeReq({ input: '{"z":1,"a":2}', format: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.formatted).toBe("string");
    expect(body.formatted).toContain("\n");
  });

  it("sorts keys recursively when sort_keys=true", async () => {
    const res = await POST(
      makeReq({
        input: '{"z":1,"a":{"d":1,"b":2}}',
        sort_keys: true,
        format: true,
      })
    );
    const body = await res.json();
    expect(body.formatted.indexOf('"a"')).toBeLessThan(
      body.formatted.indexOf('"z"')
    );
    expect(body.formatted.indexOf('"b"')).toBeLessThan(
      body.formatted.indexOf('"d"')
    );
  });
});
