import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(url: string) {
  return new NextRequest(url);
}

describe("GET /api/routes-f/country", () => {
  it("lists all when no params", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/country"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThanOrEqual(50);
    expect(Array.isArray(body.countries)).toBe(true);
  });

  it("finds by alpha2", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/country?code=NG"));
    const body = await res.json();
    expect(body.name).toBe("Nigeria");
  });

  it("finds by alpha3", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/country?code=NGA"));
    const body = await res.json();
    expect(body.alpha2).toBe("NG");
  });

  it("finds by numeric", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/country?code=566"));
    const body = await res.json();
    expect(body.alpha3).toBe("NGA");
  });

  it("finds by partial name", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/country?name=niger"));
    const body = await res.json();
    expect(body.name).toBe("Nigeria");
  });

  it("returns flag emoji", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/country?name=Japan"));
    const body = await res.json();
    expect(body.flag_emoji).toBe("????");
  });
});
