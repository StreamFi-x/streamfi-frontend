/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/ip-validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/ip-validate", () => {
  it("validates public IPv4 addresses", async () => {
    const res = await POST(makeReq({ ip: "8.8.8.8" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      valid: true,
      version: 4,
      is_private: false,
      normalized: "8.8.8.8",
    });
  });

  it("classifies private IPv4 addresses", async () => {
    const res = await POST(makeReq({ ip: "192.168.1.10" }));
    const body = await res.json();

    expect(body).toMatchObject({
      valid: true,
      version: 4,
      is_private: true,
      is_loopback: false,
    });
  });

  it("classifies IPv4 documentation ranges", async () => {
    const res = await POST(makeReq({ ip: "203.0.113.12" }));
    const body = await res.json();

    expect(body.is_documentation).toBe(true);
    expect(body.valid).toBe(true);
  });

  it("normalizes and classifies IPv6 addresses", async () => {
    const res = await POST(makeReq({ ip: "2001:0DB8:0000:0000:0000:ff00:0042:8329" }));
    const body = await res.json();

    expect(body).toMatchObject({
      valid: true,
      version: 6,
      is_documentation: true,
      normalized: "2001:db8::ff00:42:8329",
    });
  });

  it("classifies IPv6 loopback", async () => {
    const res = await POST(makeReq({ ip: "::1" }));
    const body = await res.json();

    expect(body).toMatchObject({
      valid: true,
      version: 6,
      is_private: true,
      is_loopback: true,
      normalized: "::1",
    });
  });

  it("classifies IPv6 private, link-local, and multicast ranges", async () => {
    const uniqueLocal = await (await POST(makeReq({ ip: "fd12:3456::1" }))).json();
    const linkLocal = await (await POST(makeReq({ ip: "fe80::abcd" }))).json();
    const multicast = await (await POST(makeReq({ ip: "ff02::1" }))).json();

    expect(uniqueLocal.is_private).toBe(true);
    expect(linkLocal.is_link_local).toBe(true);
    expect(multicast.is_multicast).toBe(true);
  });

  it("rejects malformed inputs", async () => {
    const badIpv4 = await (await POST(makeReq({ ip: "999.1.1.1" }))).json();
    const badIpv6 = await (await POST(makeReq({ ip: "2001:::1" }))).json();

    expect(badIpv4).toMatchObject({ valid: false, version: null, normalized: null });
    expect(badIpv6).toMatchObject({ valid: false, version: null, normalized: null });
  });
});
