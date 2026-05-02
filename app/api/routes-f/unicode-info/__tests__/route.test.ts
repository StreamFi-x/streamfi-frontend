/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(url: string) {
  return new NextRequest(url);
}

describe("GET /api/routes-f/unicode-info", () => {
  it("returns metadata for ASCII char", async () => {
    const res = await GET(
      makeReq("http://localhost/api/routes-f/unicode-info?char=A"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.codepoint).toBe("U+0041");
    expect(body.name).toMatch(/LATIN CAPITAL LETTER A/i);
    expect(Array.isArray(body.utf8_bytes)).toBe(true);
  });

  it("returns metadata for emoji by codepoint", async () => {
    const res = await GET(
      makeReq("http://localhost/api/routes-f/unicode-info?codepoint=U+1F600"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.char).toBe("😀");
    expect(body.category).toBe("Other_Symbol");
  });

  it("returns metadata for CJK char", async () => {
    const res = await GET(
      makeReq("http://localhost/api/routes-f/unicode-info?char=中"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.block).toMatch(/CJK/i);
  });

  it("returns metadata for combining mark", async () => {
    const res = await GET(
      makeReq("http://localhost/api/routes-f/unicode-info?codepoint=U+0301"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category).toBe("Nonspacing_Mark");
  });

  it("accepts decimal codepoint input", async () => {
    const res = await GET(
      makeReq("http://localhost/api/routes-f/unicode-info?codepoint=65"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.char).toBe("A");
  });
});
