/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(n: string) {
  return new NextRequest(`http://localhost/api/routes-f/catalan?n=${n}`);
}

describe("GET /api/routes-f/catalan", () => {
  it("returns C(0)=1", async () => {
    const res = await GET(makeReq("0"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.catalan).toBe("1");
    expect(body.sequence).toEqual(["1"]);
  });

  it("returns C(4)=14", async () => {
    const res = await GET(makeReq("4"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.catalan).toBe("14");
    expect(body.sequence).toEqual(["1", "1", "2", "5", "14"]);
  });

  it("returns C(10)=16796", async () => {
    const res = await GET(makeReq("10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.catalan).toBe("16796");
  });

  it("rejects n outside the supported range", async () => {
    const res = await GET(makeReq("1001"));

    expect(res.status).toBe(400);
  });
});
