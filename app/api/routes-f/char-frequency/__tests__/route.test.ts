import { charFrequency } from "../route";

describe("charFrequency", () => {
  it("counts characters and sorts by count descending", () => {
    const { frequencies, total } = charFrequency("aaabb");
    expect(total).toBe(5);
    expect(frequencies).toEqual([
      { char: "a", count: 3 },
      { char: "b", count: 2 },
    ]);
  });

  it("is case-insensitive by default and case-sensitive on request", () => {
    expect(charFrequency("aA").frequencies).toEqual([{ char: "a", count: 2 }]);
    expect(charFrequency("aA", { caseSensitive: true }).frequencies).toEqual([
      { char: "A", count: 1 },
      { char: "a", count: 1 },
    ]);
  });

  it("can ignore whitespace", () => {
    const { frequencies, total } = charFrequency("a b\tc", {
      ignoreWhitespace: true,
    });
    expect(total).toBe(3);
    expect(frequencies.find((f) => /\s/.test(f.char))).toBeUndefined();
  });

  it("limits results with top", () => {
    const { frequencies } = charFrequency("aaabbc", { top: 2 });
    expect(frequencies).toHaveLength(2);
    expect(frequencies[0]).toEqual({ char: "a", count: 3 });
  });
});
