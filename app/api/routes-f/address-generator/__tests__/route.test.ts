import { generateAddresses } from "../route";

describe("generateAddresses", () => {
  it("returns the requested count", () => {
    expect(generateAddresses(5, "US", 42)).toHaveLength(5);
    expect(generateAddresses(1, "NG", 7)).toHaveLength(1);
  });

  it("is deterministic for a given seed", () => {
    expect(generateAddresses(3, "US", 42)).toEqual(
      generateAddresses(3, "US", 42),
    );
  });

  it("produces different output for different seeds", () => {
    expect(generateAddresses(3, "US", 42)).not.toEqual(
      generateAddresses(3, "US", 43),
    );
  });

  it("uses the correct postal format per country", () => {
    expect(generateAddresses(10, "US", 1).every((a) => /^\d{5}$/.test(a.postal_code))).toBe(true);
    expect(generateAddresses(10, "NG", 1).every((a) => /^\d{6}$/.test(a.postal_code))).toBe(true);
    expect(
      generateAddresses(10, "UK", 1).every((a) =>
        /^[A-Z]{2}\d \d[A-Z]{2}$/.test(a.postal_code),
      ),
    ).toBe(true);
  });

  it("tags addresses with the country name", () => {
    expect(generateAddresses(1, "US", 1)[0].country).toBe("United States");
  });
});
