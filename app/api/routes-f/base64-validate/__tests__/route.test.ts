import { validateBase64 } from "../route";

describe("validateBase64", () => {
  it("accepts well-formed standard base64", () => {
    expect(validateBase64("Zm9vYmFy")).toEqual({
      valid: true,
      variant_detected: "standard",
      decoded_length: 6,
    });
  });

  it("accounts for padding in decoded_length", () => {
    expect(validateBase64("Zm9vYg==")).toEqual({
      valid: true,
      variant_detected: "standard",
      decoded_length: 4,
    });
  });

  it("detects the url-safe alphabet", () => {
    const r = validateBase64("a-b_");
    expect(r.valid).toBe(true);
    expect(r.variant_detected).toBe("urlsafe");
  });

  it("rejects misplaced padding", () => {
    expect(validateBase64("Zm=9").valid).toBe(false);
  });

  it("rejects the wrong charset", () => {
    expect(validateBase64("Zm9v$bcd").valid).toBe(false);
  });

  it("rejects an impossible length (len % 4 == 1)", () => {
    expect(validateBase64("Zm9vY").valid).toBe(false);
  });

  it("rejects mixed alphabets", () => {
    expect(validateBase64("ab+c-d").valid).toBe(false);
  });
});
