import { crc32, adler32, checksums } from "../route";

describe("crc32", () => {
  it("matches known vectors", () => {
    expect(crc32("")).toBe("00000000");
    expect(crc32("123456789")).toBe("cbf43926");
    expect(crc32("The quick brown fox jumps over the lazy dog")).toBe("414fa339");
  });
});

describe("adler32", () => {
  it("matches known vectors", () => {
    expect(adler32("")).toBe("00000001");
    expect(adler32("Wikipedia")).toBe("11e60398");
  });
});

describe("checksums", () => {
  it("returns both by default", () => {
    const out = checksums("123456789");
    expect(out).toEqual({ crc32: "cbf43926", adler32: adler32("123456789") });
  });

  it("returns only the requested algorithm", () => {
    expect(checksums("abc", "crc32")).toEqual({ crc32: crc32("abc") });
    expect(checksums("abc", "adler32")).toEqual({ adler32: adler32("abc") });
  });
});
