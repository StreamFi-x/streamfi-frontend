import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/routes-f/csv-parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/csv-parse", () => {
  it("parses quoted values and escaped quotes", async () => {
    const csv = 'name,quote\nAlice,"hello ""world"""';
    const res = await POST(makeReq({ csv }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.headers).toEqual(["name", "quote"]);
    expect(body.rows[0][1]).toBe('hello "world"');
  });

  it("parses embedded newlines in quotes", async () => {
    const csv = 'name,notes\nA,"line1\nline2"';
    const res = await POST(makeReq({ csv }));
    const body = await res.json();
    expect(body.rows[0][1]).toBe("line1\nline2");
  });

  it("supports custom delimiter", async () => {
    const csv = "name|score\nBob|42";
    const res = await POST(makeReq({ csv, delimiter: "|" }));
    const body = await res.json();
    expect(body.rows[0][1]).toBe(42);
  });

  it("rejects ragged rows with indexes", async () => {
    const csv = "a,b\n1,2\n3";
    const res = await POST(makeReq({ csv }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("Ragged rows");
  });
});
