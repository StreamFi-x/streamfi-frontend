import {
  decodeCursor,
  encodeCursor,
  enforceLimit,
  stableSortBy,
} from "../pagination";

describe("routes-f pagination utility", () => {
  it("encodes and decodes cursor payload", () => {
    const encoded = encodeCursor({ value: 1730000000, id: "item-1" });
    const decoded = decodeCursor(encoded);

    expect(decoded).toEqual({ value: 1730000000, id: "item-1" });
  });

  it("returns null for invalid cursor", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull();
  });

  it("enforces minimum and maximum limits", () => {
    expect(enforceLimit(0, { min: 1, max: 100, fallback: 25 })).toBe(1);
    expect(enforceLimit(101, { min: 1, max: 100, fallback: 25 })).toBe(100);
  });

  it("uses fallback limit when input is undefined", () => {
    expect(enforceLimit(undefined, { min: 5, max: 30, fallback: 12 })).toBe(12);
  });

  it("applies stable sort with id tie-breaker", () => {
    const items = [
      { id: "b", score: 10 },
      { id: "a", score: 10 },
      { id: "c", score: 12 },
    ];

    const sorted = stableSortBy(
      items,
      (item) => item.score,
      (item) => item.id,
      "desc"
    );

    expect(sorted.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
});
