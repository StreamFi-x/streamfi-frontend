/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(query: string) {
  return new NextRequest(`http://localhost/api/routes-f/palette${query}`);
}

describe("GET /api/routes-f/palette", () => {
  it("generates a triadic palette from a known seed", async () => {
    const res = await GET(makeReq("?seed=%23ff6600&scheme=triadic&count=5"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.palette).toEqual(["#ff6600", "#00ff66", "#6600ff", "#ff6600", "#00ff66"]);
  });

  it("generates a known complementary palette", async () => {
    const res = await GET(makeReq("?seed=%23ff6600&scheme=complementary&count=4"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.palette).toEqual(["#ff6600", "#0099ff", "#ff6600", "#0099ff"]);
  });

  it("rejects invalid seed", async () => {
    const res = await GET(makeReq("?seed=red&scheme=triadic"));
    expect(res.status).toBe(400);
  });

  it("rejects invalid count", async () => {
    const res = await GET(makeReq("?seed=%23ff6600&count=99"));
    expect(res.status).toBe(400);
  });
});
