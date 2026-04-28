import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/cidr", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/cidr", () => {
  describe("IPv4", () => {
    it("calculates /24 network correctly", async () => {
      const res = await POST(makeReq({ cidr: "192.168.1.0/24" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.network).toBe("192.168.1.0");
      expect(body.broadcast).toBe("192.168.1.255");
      expect(body.first_host).toBe("192.168.1.1");
      expect(body.last_host).toBe("192.168.1.254");
      expect(body.host_count).toBe(254);
      expect(body.netmask).toBe("255.255.255.0");
      expect(body.prefix_length).toBe(24);
      expect(body.version).toBe(4);
    });

    it("calculates /16 network correctly", async () => {
      const res = await POST(makeReq({ cidr: "10.0.0.0/16" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.network).toBe("10.0.0.0");
      expect(body.broadcast).toBe("10.0.255.255");
      expect(body.host_count).toBe(65534);
      expect(body.netmask).toBe("255.255.0.0");
    });

    it("calculates /8 network correctly", async () => {
      const res = await POST(makeReq({ cidr: "10.0.0.0/8" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.network).toBe("10.0.0.0");
      expect(body.broadcast).toBe("10.255.255.255");
      expect(body.host_count).toBe(16777214);
    });

    it("handles /32 (single host)", async () => {
      const res = await POST(makeReq({ cidr: "192.168.1.1/32" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.network).toBe("192.168.1.1");
      expect(body.broadcast).toBe("192.168.1.1");
      expect(body.first_host).toBe("192.168.1.1");
      expect(body.last_host).toBe("192.168.1.1");
      expect(body.host_count).toBe(1);
    });

    it("handles /31 (point-to-point, RFC 3021)", async () => {
      const res = await POST(makeReq({ cidr: "192.168.1.0/31" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.host_count).toBe(2);
      expect(body.first_host).toBe("192.168.1.0");
      expect(body.last_host).toBe("192.168.1.1");
    });

    it("handles /0 (entire internet)", async () => {
      const res = await POST(makeReq({ cidr: "0.0.0.0/0" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.network).toBe("0.0.0.0");
      expect(body.broadcast).toBe("255.255.255.255");
    });

    it("masks host bits from input IP", async () => {
      const res = await POST(makeReq({ cidr: "192.168.1.100/24" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.network).toBe("192.168.1.0");
    });
  });

  describe("IPv6", () => {
    it("calculates /64 network correctly", async () => {
      const res = await POST(makeReq({ cidr: "2001:db8::/64" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.version).toBe(6);
      expect(body.prefix_length).toBe(64);
      expect(body.network).toContain("2001");
    });

    it("calculates /128 (single host)", async () => {
      const res = await POST(makeReq({ cidr: "::1/128" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.host_count).toBe(1);
      expect(body.version).toBe(6);
    });

    it("calculates /48 network", async () => {
      const res = await POST(makeReq({ cidr: "2001:db8:abcd::/48" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.version).toBe(6);
      expect(body.prefix_length).toBe(48);
    });
  });

  describe("validation", () => {
    it("returns 400 for missing cidr", async () => {
      const res = await POST(makeReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid CIDR (no slash)", async () => {
      const res = await POST(makeReq({ cidr: "192.168.1.0" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid IPv4 address", async () => {
      const res = await POST(makeReq({ cidr: "999.168.1.0/24" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for prefix out of range (IPv4)", async () => {
      const res = await POST(makeReq({ cidr: "192.168.1.0/33" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for prefix out of range (IPv6)", async () => {
      const res = await POST(makeReq({ cidr: "2001:db8::/129" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-numeric prefix", async () => {
      const res = await POST(makeReq({ cidr: "192.168.1.0/abc" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest("http://localhost/api/routes-f/cidr", {
        method: "POST",
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
