import { base32Encode, base32Decode } from "../route";

describe("base32Encode", () => {
  it("matches RFC 4648 test vectors", () => {
    expect(base32Encode("")).toBe("");
    expect(base32Encode("f")).toBe("MY======");
    expect(base32Encode("fo")).toBe("MZXQ====");
    expect(base32Encode("foo")).toBe("MZXW6===");
    expect(base32Encode("foobar")).toBe("MZXW6YTBOI======");
  });

  it("omits padding when padding=false", () => {
    expect(base32Encode("foobar", false)).toBe("MZXW6YTBOI");
  });
});

describe("base32Decode", () => {
  it("decodes RFC 4648 vectors (with or without padding)", () => {
    expect(base32Decode("MZXW6YTBOI======")).toBe("foobar");
    expect(base32Decode("MZXW6YTBOI")).toBe("foobar");
    expect(base32Decode("MY======")).toBe("f");
  });

  it("round-trips arbitrary input", () => {
    for (const s of ["hello world", "Stellar ⭐", "a", "12345"]) {
      expect(base32Decode(base32Encode(s))).toBe(s);
    }
  });

  it("throws on invalid base32 characters", () => {
    expect(() => base32Decode("0189")).toThrow(RangeError); // 0,1,8,9 not in alphabet
  });
});
