/**
 * @jest-environment node
 *
 * Unit tests for the hash helper functions.
 * Pure logic — no Next.js dependencies, no HTTP.
 *
 * Known-vector test data sourced from:
 *   - MD5:    RFC 1321  (https://www.rfc-editor.org/rfc/rfc1321)
 *   - SHA-1:  RFC 3174  (https://www.rfc-editor.org/rfc/rfc3174)
 *   - SHA-256/512: NIST FIPS 180-4 / RFC 6234
 */

import {
  computeHash,
  isSupportedAlgorithm,
  isSupportedEncoding,
  INSECURE_ALGORITHMS,
  INSECURE_WARNING,
  SUPPORTED_ALGORITHMS,
  SUPPORTED_ENCODINGS,
} from "../_lib/helpers";

// ── Known-vector data ─────────────────────────────────────────────────────────

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

describe("computeHash — hex encoding (known vectors)", () => {
  test.each(HEX_VECTORS)("$label", ({ algorithm, input, expected }) => {
    const result = computeHash(
      input,
      algorithm as Parameters<typeof computeHash>[1]
    );
    expect(result).toBe(expected);
  });
});

describe("computeHash — base64 encoding", () => {
  it("SHA-256 of 'abc' base64 round-trips to known hex", () => {
    const b64 = computeHash("abc", "sha256", "base64");
    const hexFromBase64 = Buffer.from(b64, "base64").toString("hex");
    expect(hexFromBase64).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("MD5 of 'abc' base64 round-trips to known hex", () => {
    const b64 = computeHash("abc", "md5", "base64");
    const hexFromBase64 = Buffer.from(b64, "base64").toString("hex");
    expect(hexFromBase64).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("SHA-512 of empty string base64 round-trips to known hex", () => {
    const b64 = computeHash("", "sha512", "base64");
    const hexFromBase64 = Buffer.from(b64, "base64").toString("hex");
    expect(hexFromBase64).toBe(
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
    );
  });
});

describe("computeHash — default encoding", () => {
  it("defaults to hex when encoding is omitted", () => {
    const withDefault = computeHash("abc", "sha256");
    const withExplicit = computeHash("abc", "sha256", "hex");
    expect(withDefault).toBe(withExplicit);
  });
});

describe("isSupportedAlgorithm", () => {
  it.each(["md5", "sha1", "sha256", "sha512"])(
    "returns true for '%s'",
    (alg) => expect(isSupportedAlgorithm(alg)).toBe(true)
  );

  it.each(["sha3", "sha3-256", "blake2", "", null, undefined, 42])(
    "returns false for %p",
    (alg) => expect(isSupportedAlgorithm(alg)).toBe(false)
  );
});

describe("isSupportedEncoding", () => {
  it.each(["hex", "base64"])(
    "returns true for '%s'",
    (enc) => expect(isSupportedEncoding(enc)).toBe(true)
  );

  it.each(["binary", "utf8", "", null, undefined])(
    "returns false for %p",
    (enc) => expect(isSupportedEncoding(enc)).toBe(false)
  );
});

describe("INSECURE_ALGORITHMS", () => {
  it("flags md5 as insecure", () =>
    expect(INSECURE_ALGORITHMS.has("md5")).toBe(true));
  it("flags sha1 as insecure", () =>
    expect(INSECURE_ALGORITHMS.has("sha1")).toBe(true));
  it("does not flag sha256", () =>
    expect(INSECURE_ALGORITHMS.has("sha256")).toBe(false));
  it("does not flag sha512", () =>
    expect(INSECURE_ALGORITHMS.has("sha512")).toBe(false));
});

describe("SUPPORTED_ALGORITHMS / SUPPORTED_ENCODINGS sets", () => {
  it("contains exactly the four expected algorithms", () => {
    expect([...SUPPORTED_ALGORITHMS].sort()).toEqual([
      "md5",
      "sha1",
      "sha256",
      "sha512",
    ]);
  });

  it("contains exactly the two expected encodings", () => {
    expect([...SUPPORTED_ENCODINGS].sort()).toEqual(["base64", "hex"]);
  });
});

describe("INSECURE_WARNING", () => {
  it("is a non-empty string", () => {
    expect(typeof INSECURE_WARNING).toBe("string");
    expect(INSECURE_WARNING.length).toBeGreaterThan(0);
  });
});
