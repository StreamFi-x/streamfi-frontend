/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/mac-validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/mac-validate", () => {
  it.each([
    ["00:11:22:33:44:55", "colon", "00:11:22:33:44:55"],
    ["00-11-22-33-44-55", "dash", "00-11-22-33-44-55"],
    ["0011.2233.4455", "dot", "0011.2233.4455"],
    ["001122334455", "none", "001122334455"],
  ])("accepts %s and formats as %s", async (mac, format, normalized) => {
    const res = await POST(makeReq({ mac, format }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.normalized).toBe(normalized);
  });

  it("detects unicast and globally administered addresses", async () => {
    const res = await POST(makeReq({ mac: "00:11:22:33:44:55" }));
    const body = await res.json();

    expect(body.is_unicast).toBe(true);
    expect(body.is_multicast).toBe(false);
    expect(body.is_locally_administered).toBe(false);
    expect(body.oui).toBe("Cimsys");
  });

  it("detects multicast addresses", async () => {
    const res = await POST(makeReq({ mac: "01:00:5E:00:00:FB" }));
    const body = await res.json();

    expect(body.is_unicast).toBe(false);
    expect(body.is_multicast).toBe(true);
  });

  it("detects locally administered addresses", async () => {
    const res = await POST(makeReq({ mac: "02:00:00:00:00:01" }));
    const body = await res.json();

    expect(body.is_locally_administered).toBe(true);
  });

  it("rejects malformed MAC addresses", async () => {
    const res = await POST(makeReq({ mac: "00:11:22:33:44" }));

    expect(res.status).toBe(400);
  });
});
