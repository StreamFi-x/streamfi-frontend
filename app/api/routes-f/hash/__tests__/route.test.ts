/**
 * Unit tests for POST /api/routes-f/hash route handler.
 *
 * NextResponse is mocked so the jsdom environment's lack of
 * Response.json() does not interfere.
 *
 * Known-vector test data sourced from:
 *   - MD5:    RFC 1321  (https://www.rfc-editor.org/rfc/rfc1321)
 *   - SHA-1:  RFC 3174  (https://www.rfc-editor.org/rfc/rfc3174)
 *   - SHA-256/512: NIST FIPS 180-4 / RFC 6234
 */

// ── Mock NextResponse before any imports that pull it in ─────────────────────
jest.mock("next/server", () => {
  const actual = jest.requireActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        json: () => Promise.resolve(body),
      }),
    },
  };
});

import { POST, OPTIONS } from "../route";
import { INSECURE_WARNING } from "../_lib/helpers";
import type { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal request stub — the handler only calls req.json(). */
function makeRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

/** Stub that simulates a JSON parse failure. */
function makeBadRequest(): NextRequest {
  return {
    json: () => Promise.reject(new SyntaxError("Unexpected token")),
  } as unknown as NextRequest;
}

async function postHash(body: unknown) {
  const res = await POST(makeRequest(body));
  const json = await res.json();
  return { status: res.status, body: json };
}

// ── Known-vector data (same vectors as helpers.test.ts) ──────────────────────

const HEX_VECTORS: Array<{
  algorithm: string;
  input: string;
  expected: string;
  label: string;
}> = [
  // MD5 — RFC 1321
  {
    algorithm: "md5",
    input: "",
    expected: "d41d8cd98f00b204e9800998ecf8427e",
    label: "MD5 of empty string (RFC 1321)",
  },
  {
    algorithm: "md5",
    input: "abc",
    expected: "900150983cd24fb0d6963f7d28e17f72",
    label: "MD5 of 'abc' (RFC 1321)",
  },
  {
    algorithm: "md5",
    input: "The quick brown fox jumps over the lazy dog",
    expected: "9e107d9d372bb6826bd81d3542a419d6",
    label: "MD5 of pangram",
  },

  // SHA-1 — RFC 3174
  {
    algorithm: "sha1",
    input: "abc",
    expected: "a9993e364706816aba3e25717850c26c9cd0d89d",
    label: "SHA-1 of 'abc' (RFC 3174)",
  },
  {
    algorithm: "sha1",
    input: "",
    expected: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    label: "SHA-1 of empty string (RFC 3174)",
  },
  {
    algorithm: "sha1",
    input: "The quick brown fox jumps over the lazy dog",
    expected: "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12",
    label: "SHA-1 of pangram",
  },

  // SHA-256 — NIST FIPS 180-4
  {
    algorithm: "sha256",
    input: "abc",
    expected:
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    label: "SHA-256 of 'abc' (NIST)",
  },
  {
    algorithm: "sha256",
    input: "",
    expected:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    label: "SHA-256 of empty string (NIST)",
  },
  {
    algorithm: "sha256",
    input: "The quick brown fox jumps over the lazy dog",
    expected:
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    label: "SHA-256 of pangram",
  },

  // SHA-512 — NIST FIPS 180-4
  {
    algorithm: "sha512",
    input: "abc",
    expected:
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    label: "SHA-512 of 'abc' (NIST)",
  },
  {
    algorithm: "sha512",
    input: "",
    expected:
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    label: "SHA-512 of empty string (NIST)",
  },
  {
    algorithm: "sha512",
    input: "The quick brown fox jumps over the lazy dog",
    expected:
      "07e547d9586f6a73f73fbac0435ed76951218fb7d0c8d788a309d785436bbb642e93a252a954f23912547d1e8a3b5ed6e1bfd7097821233fa0538f3db854fee6",
    label: "SHA-512 of pangram",
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/routes-f/hash", () => {
  // ── Correctness — all four algorithms, hex encoding ───────────────────────
  describe("hex encoding — known vectors", () => {
    test.each(HEX_VECTORS)("$label", async ({ algorithm, input, expected }) => {
      const { status, body } = await postHash({ input, algorithm });
      expect(status).toBe(200);
      expect(body.hash).toBe(expected);
      expect(body.algorithm).toBe(algorithm);
      expect(body.encoding).toBe("hex");
    });
  });

  // ── Base64 encoding ────────────────────────────────────────────────────────
  describe("base64 encoding", () => {
    it("returns correct base64 for SHA-256 of 'abc'", async () => {
      const { status, body } = await postHash({
        input: "abc",
        algorithm: "sha256",
        encoding: "base64",
      });
      expect(status).toBe(200);
      expect(body.encoding).toBe("base64");
      const hexFromBase64 = Buffer.from(body.hash, "base64").toString("hex");
      expect(hexFromBase64).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
      );
    });

    it("returns correct base64 for MD5 of 'abc'", async () => {
      const { status, body } = await postHash({
        input: "abc",
        algorithm: "md5",
        encoding: "base64",
      });
      expect(status).toBe(200);
      expect(body.encoding).toBe("base64");
      const hexFromBase64 = Buffer.from(body.hash, "base64").toString("hex");
      expect(hexFromBase64).toBe("900150983cd24fb0d6963f7d28e17f72");
    });

    it("returns correct base64 for SHA-512 of empty string", async () => {
      const { status, body } = await postHash({
        input: "",
        algorithm: "sha512",
        encoding: "base64",
      });
      expect(status).toBe(200);
      expect(body.encoding).toBe("base64");
      const hexFromBase64 = Buffer.from(body.hash, "base64").toString("hex");
      expect(hexFromBase64).toBe(
        "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
      );
    });
  });

  // ── Default encoding ───────────────────────────────────────────────────────
  describe("default encoding", () => {
    it("defaults to hex when encoding is omitted", async () => {
      const { status, body } = await postHash({
        input: "abc",
        algorithm: "sha256",
      });
      expect(status).toBe(200);
      expect(body.encoding).toBe("hex");
    });
  });

  // ── Insecure algorithm warnings ────────────────────────────────────────────
  describe("insecure algorithm warnings", () => {
    it("includes a warning for md5", async () => {
      const { status, body } = await postHash({
        input: "test",
        algorithm: "md5",
      });
      expect(status).toBe(200);
      expect(body.warning).toBe(INSECURE_WARNING);
    });

    it("includes a warning for sha1", async () => {
      const { status, body } = await postHash({
        input: "test",
        algorithm: "sha1",
      });
      expect(status).toBe(200);
      expect(body.warning).toBe(INSECURE_WARNING);
    });

    it("does NOT include a warning for sha256", async () => {
      const { status, body } = await postHash({
        input: "test",
        algorithm: "sha256",
      });
      expect(status).toBe(200);
      expect(body.warning).toBeUndefined();
    });

    it("does NOT include a warning for sha512", async () => {
      const { status, body } = await postHash({
        input: "test",
        algorithm: "sha512",
      });
      expect(status).toBe(200);
      expect(body.warning).toBeUndefined();
    });
  });

  // ── Input validation — 400 errors ─────────────────────────────────────────
  describe("input validation", () => {
    it("returns 400 for unknown algorithm", async () => {
      const { status, body } = await postHash({
        input: "hello",
        algorithm: "sha3",
      });
      expect(status).toBe(400);
      expect(body.error).toMatch(/unsupported algorithm/i);
      expect(body.error).toContain("sha3");
    });

    it("returns 400 for unknown encoding", async () => {
      const { status, body } = await postHash({
        input: "hello",
        algorithm: "sha256",
        encoding: "binary",
      });
      expect(status).toBe(400);
      expect(body.error).toMatch(/unsupported encoding/i);
    });

    it("returns 400 when input is missing", async () => {
      const { status, body } = await postHash({ algorithm: "sha256" });
      expect(status).toBe(400);
      expect(body.error).toMatch(/input/i);
    });

    it("returns 400 when input is not a string", async () => {
      const { status, body } = await postHash({
        input: 42,
        algorithm: "sha256",
      });
      expect(status).toBe(400);
      expect(body.error).toMatch(/input/i);
    });

    it("returns 400 when algorithm is missing", async () => {
      const { status, body } = await postHash({ input: "hello" });
      expect(status).toBe(400);
      expect(body.error).toMatch(/unsupported algorithm/i);
    });

    it("returns 400 for malformed JSON body", async () => {
      const res = await POST(makeBadRequest());
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/json/i);
    });

    it("returns 400 when body is a JSON array instead of object", async () => {
      const { status, body } = await postHash([]);
      expect(status).toBe(400);
      expect(body.error).toMatch(/object/i);
    });
  });

  // ── Response shape ─────────────────────────────────────────────────────────
  describe("response shape", () => {
    it("always returns hash, algorithm, and encoding on success", async () => {
      const { status, body } = await postHash({
        input: "hello",
        algorithm: "sha256",
      });
      expect(status).toBe(200);
      expect(typeof body.hash).toBe("string");
      expect(body.algorithm).toBe("sha256");
      expect(body.encoding).toBe("hex");
    });

    it("reflects the requested encoding in the response", async () => {
      const { body } = await postHash({
        input: "hello",
        algorithm: "sha256",
        encoding: "base64",
      });
      expect(body.encoding).toBe("base64");
    });
  });

  // ── OPTIONS (CORS pre-flight) ──────────────────────────────────────────────
  describe("OPTIONS", () => {
    it("returns 204 with CORS headers", () => {
      const res = OPTIONS();
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });
  });
});
