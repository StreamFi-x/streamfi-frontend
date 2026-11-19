import { lookupIpLocation } from "@/lib/sessions/geoip";

describe("lookupIpLocation", () => {
  it("returns unknown when no local database is configured", async () => {
    const previous = process.env.GEOIP_CITY_DB_PATH;
    delete process.env.GEOIP_CITY_DB_PATH;
    await expect(lookupIpLocation("203.0.113.1")).resolves.toBe("Unknown location");
    if (previous) {process.env.GEOIP_CITY_DB_PATH = previous;}
  });

  it("rejects malformed IP values without attempting lookup", async () => {
    await expect(lookupIpLocation("not-an-ip")).resolves.toBe("Unknown location");
  });
});