/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../trailing-zeros-factorial/route";

function makeReq(query: string) {
  return new NextRequest(
    `http://localhost/api/routesF/trailing-zeros-factorial?${query}`
  );
}

describe("/api/routesF/trailing-zeros-factorial", () => {
  it("returns trailing zeros for n=100", async () => {
    const res = await GET(makeReq("n=100"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.n).toBe(100);
    expect(data.trailing_zeros).toBe(24);
  });

  it("returns zero trailing zeros for n=0", async () => {
    const res = await GET(makeReq("n=0"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.n).toBe(0);
    expect(data.trailing_zeros).toBe(0);
  });

  it("returns the correct count for a large n", async () => {
    const res = await GET(makeReq("n=1000000"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.n).toBe(1000000);
    expect(data.trailing_zeros).toBe(249998);
  });

  it("rejects missing n parameter", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/routesF/trailing-zeros-factorial")
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid n values", async () => {
    const res = await GET(makeReq("n=-1"));
    expect(res.status).toBe(400);
  });
});
