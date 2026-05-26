import { hexDump } from "../route";

describe("hexDump", () => {
  it("formats offset, hex bytes, and an ASCII gutter", () => {
    const dump = hexDump("Hello");
    expect(dump.startsWith("00000000  48 65 6c 6c 6f")).toBe(true);
    expect(dump).toContain("|Hello|");
  });

  it("expands UTF-8 multibyte characters into their bytes", () => {
    const dump = hexDump("é"); // U+00E9 -> 0xC3 0xA9
    expect(dump).toContain("c3 a9");
    expect(dump).toContain("|..|"); // non-printable bytes render as dots
  });

  it("wraps lines with incrementing offsets", () => {
    const lines = hexDump("ABCDE", 4).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith("00000000  41 42 43 44")).toBe(true);
    expect(lines[0]).toContain("|ABCD|");
    expect(lines[1].startsWith("00000004  45")).toBe(true);
    expect(lines[1]).toContain("|E|");
  });

  it("returns an empty string for empty input", () => {
    expect(hexDump("")).toBe("");
  });
});
