import { codeToFlag, flagToCode } from "../route";

describe("codeToFlag", () => {
  it("converts codes to flag emoji", () => {
    expect(codeToFlag("NG")).toBe("🇳🇬");
    expect(codeToFlag("us")).toBe("🇺🇸");
    expect(codeToFlag("GB")).toBe("🇬🇧");
  });
  it("rejects invalid codes", () => {
    expect(() => codeToFlag("N")).toThrow();
    expect(() => codeToFlag("N1")).toThrow();
  });
});

describe("flagToCode", () => {
  it("converts flag emoji back to codes", () => {
    expect(flagToCode("🇳🇬")).toBe("NG");
    expect(flagToCode("🇺🇸")).toBe("US");
  });
  it("round-trips", () => {
    for (const c of ["NG", "US", "GB", "JP", "DE"]) {
      expect(flagToCode(codeToFlag(c))).toBe(c);
    }
  });
  it("rejects non-flag input", () => {
    expect(() => flagToCode("AB")).toThrow();
    expect(() => flagToCode("🇳")).toThrow();
  });
});
