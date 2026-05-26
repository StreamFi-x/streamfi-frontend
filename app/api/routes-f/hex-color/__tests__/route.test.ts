import { normalizeHexColor } from "../route";

describe("normalizeHexColor", () => {
  it("normalizes 3-digit to 6-digit", () => {
    expect(normalizeHexColor("#abc")).toEqual({
      valid: true,
      normalized: "#aabbcc",
      has_alpha: false,
    });
  });

  it("normalizes 4-digit to 8-digit with alpha", () => {
    expect(normalizeHexColor("#abcd")).toEqual({
      valid: true,
      normalized: "#aabbccdd",
      has_alpha: true,
    });
  });

  it("accepts 6-digit (no #) and lowercases", () => {
    expect(normalizeHexColor("FF8800")).toEqual({
      valid: true,
      normalized: "#ff8800",
      has_alpha: false,
    });
  });

  it("accepts 8-digit with alpha", () => {
    expect(normalizeHexColor("#ff8800cc")).toEqual({
      valid: true,
      normalized: "#ff8800cc",
      has_alpha: true,
    });
  });

  it("rejects invalid input", () => {
    for (const bad of ["#12", "#xyz", "12345", "#1234567", "nope"]) {
      expect(normalizeHexColor(bad)).toEqual({
        valid: false,
        normalized: null,
        has_alpha: false,
      });
    }
  });
});
