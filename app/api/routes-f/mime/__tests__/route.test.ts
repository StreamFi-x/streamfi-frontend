import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(url: string) {
  return new NextRequest(url);
}

describe("GET /api/routes-f/mime", () => {
  it("looks up by extension", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/mime?extension=png"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mime).toBe("image/png");
    expect(body.category).toBe("image");
  });

  it("looks up by mime", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/mime?mime=text/html"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.extensions).toContain("html");
  });

  it("supports common types", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/mime?extension=mp3"));
    const body = await res.json();
    expect(body.mime).toBe("audio/mpeg");
  });

  it("returns 404 and suggestions for unknown extension", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/mime?extension=pnx"));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(Array.isArray(body.suggestions)).toBe(true);
  });
});
