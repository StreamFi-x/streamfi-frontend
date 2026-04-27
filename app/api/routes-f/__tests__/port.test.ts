/**
 * @jest-environment node
 */
import { GET } from "../port/route";
import { NextRequest } from "next/server";

function makeReq(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/port");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

describe("/api/routes-f/port", () => {
  describe("GET ?port=<n>", () => {
    it("returns info for port 80", async () => {
      const res = await GET(makeReq({ port: "80" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.port).toBe(80);
      expect(data.service).toBe("http");
      expect(data.protocols).toContain("TCP");
    });

    it("returns info for port 443", async () => {
      const res = await GET(makeReq({ port: "443" }));
      const data = await res.json();
      expect(data.service).toBe("https");
    });

    it("returns info for port 22 (SSH)", async () => {
      const res = await GET(makeReq({ port: "22" }));
      const data = await res.json();
      expect(data.service).toBe("ssh");
    });

    it("returns dual-protocol services (DNS port 53)", async () => {
      const res = await GET(makeReq({ port: "53" }));
      const data = await res.json();
      expect(data.protocols).toContain("TCP");
      expect(data.protocols).toContain("UDP");
    });

    it("returns 404 for unknown port", async () => {
      const res = await GET(makeReq({ port: "9999" }));
      expect(res.status).toBe(404);
    });

    it("rejects out-of-range port", async () => {
      const res = await GET(makeReq({ port: "70000" }));
      expect(res.status).toBe(400);
    });

    it("rejects non-numeric port", async () => {
      const res = await GET(makeReq({ port: "abc" }));
      expect(res.status).toBe(400);
    });
  });

  describe("GET ?service=<name>", () => {
    it("returns port for ssh service", async () => {
      const res = await GET(makeReq({ service: "ssh" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.port).toBe(22);
    });

    it("is case-insensitive for service name", async () => {
      const res = await GET(makeReq({ service: "HTTPS" }));
      const data = await res.json();
      expect(data.port).toBe(443);
    });

    it("returns 404 for unknown service", async () => {
      const res = await GET(makeReq({ service: "unknownxyz" }));
      expect(res.status).toBe(404);
    });
  });

  it("returns 400 with no params", async () => {
    const res = await GET(new NextRequest("http://localhost/api/routes-f/port"));
    expect(res.status).toBe(400);
  });
});
