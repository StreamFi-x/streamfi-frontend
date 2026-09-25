import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/routes-f/health-check", () => {
  it("returns 200 with service connectivity flags and app version", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/routes-f/health-check"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.status).toBe("healthy");
    expect(data.version).toBeDefined();
    expect(data.db).toBe(true);
    expect(data.cache).toBe(true);
    expect(data.mux).toBe(true);
    expect(data.stellar).toBe(true);
    expect(data.services.db.connected).toBe(true);
    expect(data.services.cache.connected).toBe(true);
    expect(data.services.mux.connected).toBe(true);
    expect(data.services.stellar.connected).toBe(true);
  });
});
