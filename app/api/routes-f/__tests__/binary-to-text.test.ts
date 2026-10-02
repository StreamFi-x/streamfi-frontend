// @ts-nocheck
/**
 * @jest-environment node
 */
import { POST, toBinary, fromBinary } from "../binary-to-text/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/binary-to-text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/binary-to-text", () => {
  // --- unit helpers ---
  describe("toBinary", () => {
    it("encodes ASCII correctly", () => {
      expect(toBinary("A", 8)).toBe("01000001");
      expect(toBinary("Hi", 8)).toBe("01001000 01101001");
    });

    it("round-trips ASCII with fromBinary", () => {
      const bin = toBinary("Hello, World!", 8);
      expect(fromBinary(bin, 8)).toBe("Hello, World!");
    });

    it("round-trips emoji (multibyte UTF-8)", () => {
      const bin = toBinary("😊", 8);
      expect(fromBinary(bin, 8)).toBe("😊");
    });

    it("round-trips mixed ASCII + emoji", () => {
      const input = "hi 🌍";
      expect(fromBinary(toBinary(input, 8), 8)).toBe(input);
    });
  });

  describe("fromBinary", () => {
    it("rejects non-binary characters", () => {
      expect(() => fromBinary("01000001 0100GG01", 8)).toThrow();
    });

    it("rejects tokens with wrong bit length", () => {
      expect(() => fromBinary("0100000", 8)).toThrow(); // 7 bits
    });
  });

  // --- POST handler ---
  it("to_binary returns correct result for ASCII", async () => {
    const res = await POST(makeReq({ input: "A", mode: "to_binary" }));
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result).toBe("01000001");
  });

  it("from_binary decodes back to original ASCII", async () => {
    const res = await POST(makeReq({ input: "01000001", mode: "from_binary" }));
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result).toBe("A");
  });

  it("round-trips emoji via POST", async () => {
    const encRes = await POST(makeReq({ input: "😊", mode: "to_binary" }));
    const { result: bin } = await encRes.json();

    const decRes = await POST(makeReq({ input: bin, mode: "from_binary" }));
    expect(decRes.status).toBe(200);
    const { result } = await decRes.json();
    expect(result).toBe("😊");
  });

  it("returns 400 for malformed binary on decode", async () => {
    const res = await POST(makeReq({ input: "0100GG01", mode: "from_binary" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for wrong bit-length token", async () => {
    const res = await POST(makeReq({ input: "0100000", mode: "from_binary" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing mode", async () => {
    const res = await POST(makeReq({ input: "hello" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing input", async () => {
    const res = await POST(makeReq({ mode: "to_binary" }));
    expect(res.status).toBe(400);
  });

  it("handles empty string to_binary", async () => {
    const res = await POST(makeReq({ input: "", mode: "to_binary" }));
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result).toBe("");
  });
});
