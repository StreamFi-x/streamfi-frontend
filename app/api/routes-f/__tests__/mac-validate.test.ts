/**
 * @jest-environment node
 */
import { POST } from "../mac-validate/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/mac-validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/mac-validate", () => {
  describe("input format acceptance", () => {
    it("accepts colon format", async () => {
      const res = await POST(makeReq({ mac: "00:11:22:33:44:55" }));
      expect(res.status).toBe(200);
      const d = await res.json();
      expect(d.valid).toBe(true);
    });

    it("accepts dash format", async () => {
      const res = await POST(makeReq({ mac: "00-11-22-33-44-55" }));
      expect(res.status).toBe(200);
      expect((await res.json()).valid).toBe(true);
    });

    it("accepts dot format", async () => {
      const res = await POST(makeReq({ mac: "0011.2233.4455" }));
      expect(res.status).toBe(200);
      expect((await res.json()).valid).toBe(true);
    });

    it("accepts bare hex format", async () => {
      const res = await POST(makeReq({ mac: "001122334455" }));
      expect(res.status).toBe(200);
      expect((await res.json()).valid).toBe(true);
    });
  });

  describe("output formatting", () => {
    it("normalizes to colon by default", async () => {
      const res = await POST(makeReq({ mac: "001122334455" }));
      const d = await res.json();
      expect(d.normalized).toBe("00:11:22:33:44:55");
    });

    it("formats to dash", async () => {
      const res = await POST(makeReq({ mac: "001122334455", format: "dash" }));
      expect((await res.json()).normalized).toBe("00-11-22-33-44-55");
    });

    it("formats to dot", async () => {
      const res = await POST(makeReq({ mac: "001122334455", format: "dot" }));
      expect((await res.json()).normalized).toBe("0011.2233.4455");
    });

    it("formats to none (bare hex)", async () => {
      const res = await POST(makeReq({ mac: "00:11:22:33:44:55", format: "none" }));
      expect((await res.json()).normalized).toBe("001122334455");
    });
  });

  describe("unicast / multicast detection", () => {
    it("detects unicast MAC (LSB of first byte = 0)", async () => {
      const res = await POST(makeReq({ mac: "00:11:22:33:44:55" }));
      const d = await res.json();
      expect(d.is_unicast).toBe(true);
      expect(d.is_multicast).toBe(false);
    });

    it("detects multicast MAC (LSB of first byte = 1)", async () => {
      const res = await POST(makeReq({ mac: "01:00:5E:00:00:01" }));
      const d = await res.json();
      expect(d.is_multicast).toBe(true);
      expect(d.is_unicast).toBe(false);
    });
  });

  describe("validation errors", () => {
    it("rejects malformed MAC", async () => {
      const res = await POST(makeReq({ mac: "ZZ:ZZ:ZZ:ZZ:ZZ:ZZ" }));
      expect(res.status).toBe(400);
    });

    it("rejects empty string", async () => {
      const res = await POST(makeReq({ mac: "" }));
      expect(res.status).toBe(400);
    });

    it("rejects invalid format option", async () => {
      const res = await POST(makeReq({ mac: "00:11:22:33:44:55", format: "hex" }));
      expect(res.status).toBe(400);
    });

    it("rejects missing mac field", async () => {
      const res = await POST(makeReq({}));
      expect(res.status).toBe(400);
    });
  });
});
