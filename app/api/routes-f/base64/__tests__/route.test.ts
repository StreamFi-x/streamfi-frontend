import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/base64", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/base64", () => {
  describe("encode", () => {
    it("encodes string to standard base64", async () => {
      const res = await POST(makeReq({ input: "hello", mode: "encode" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.output).toBe("aGVsbG8=");
    });

    it("encodes with url-safe variant", async () => {
      const res = await POST(
        makeReq({ input: "hello?world+test", mode: "encode", variant: "urlsafe" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      // URL-safe replaces + with - and / with _
      expect(body.output).not.toContain("+");
      expect(body.output).not.toContain("/");
    });

    it("removes padding when padding=false", async () => {
      const res = await POST(
        makeReq({ input: "hello", mode: "encode", padding: false })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.output).not.toContain("=");
    });

    it("includes padding by default", async () => {
      const res = await POST(makeReq({ input: "a", mode: "encode" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.output).toContain("=");
    });
  });

  describe("decode", () => {
    it("decodes standard base64", async () => {
      const res = await POST(makeReq({ input: "aGVsbG8=", mode: "decode" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.output).toBe("hello");
    });

    it("decodes without padding", async () => {
      const res = await POST(makeReq({ input: "aGVsbG8", mode: "decode" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.output).toBe("hello");
    });

    it("decodes url-safe variant", async () => {
      const res = await POST(
        makeReq({ input: "aGVsbG8-IHdvcmxkIQ", mode: "decode", variant: "urlsafe" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.output).toBe("hello>world!");
    });

    it("returns 400 for invalid base64", async () => {
      const res = await POST(makeReq({ input: "!!!invalid!!!", mode: "decode" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("round-trip", () => {
    it("encode then decode is lossless", async () => {
      const original = "The quick brown fox";

      const encRes = await POST(makeReq({ input: original, mode: "encode" }));
      const encBody = await encRes.json();

      const decRes = await POST(makeReq({ input: encBody.output, mode: "decode" }));
      const decBody = await decRes.json();

      expect(decBody.output).toBe(original);
    });

    it("round-trip with url-safe variant", async () => {
      const original = "test+value/with=special";

      const encRes = await POST(
        makeReq({ input: original, mode: "encode", variant: "urlsafe" })
      );
      const encBody = await encRes.json();

      const decRes = await POST(
        makeReq({ input: encBody.output, mode: "decode", variant: "urlsafe" })
      );
      const decBody = await decRes.json();

      expect(decBody.output).toBe(original);
    });
  });

  describe("validation", () => {
    it("returns 400 for missing input", async () => {
      const res = await POST(makeReq({ mode: "encode" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid mode", async () => {
      const res = await POST(makeReq({ input: "test", mode: "invalid" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid variant", async () => {
      const res = await POST(makeReq({ input: "test", mode: "encode", variant: "bad" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for oversized input", async () => {
      const largeInput = "x".repeat(1024 * 1024 + 1);
      const res = await POST(makeReq({ input: largeInput, mode: "encode" }));
      expect(res.status).toBe(400);
    });
  });
});
