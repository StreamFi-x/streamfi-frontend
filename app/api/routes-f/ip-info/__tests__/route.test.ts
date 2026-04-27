import { GET } from "../route";

describe("GET /api/routes-f/ip-info", () => {
  it("returns deterministic geolocation for a valid IPv4 address", async () => {
    const first = await GET(new Request("http://localhost/api/routes-f/ip-info?ip=8.8.8.8"));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.ip).toBe("8.8.8.8");
    expect(typeof firstBody.country).toBe("string");
    expect(typeof firstBody.lat).toBe("number");
    expect(typeof firstBody.lng).toBe("number");

    const second = await GET(new Request("http://localhost/api/routes-f/ip-info?ip=8.8.8.8"));
    const secondBody = await second.json();
    expect(secondBody).toEqual(firstBody);
  });

  it("treats private IPv4 addresses as private", async () => {
    const res = await GET(new Request("http://localhost/api/routes-f/ip-info?ip=192.168.1.1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_private).toBe(true);
  });

  it("returns private for loopback IPv6", async () => {
    const res = await GET(new Request("http://localhost/api/routes-f/ip-info?ip=::1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_private).toBe(true);
  });

  it("rejects malformed IP addresses", async () => {
    const res = await GET(new Request("http://localhost/api/routes-f/ip-info?ip=999.999.999.999"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid IP address");
  });
});
