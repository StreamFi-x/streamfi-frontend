import { hammingDistance } from "../route";

describe("hammingDistance", () => {
  it("computes distance for equal-length strings", () => {
    expect(hammingDistance("karolin", "kathrin")).toBe(3);
    expect(hammingDistance("karolin", "kerstin")).toBe(3);
    expect(hammingDistance("abc", "abc")).toBe(0);
  });

  it("computes distance for binary inputs", () => {
    expect(hammingDistance("1011101", "1001001")).toBe(2);
    expect(hammingDistance("0000", "1111")).toBe(4);
  });

  it("throws on unequal lengths", () => {
    expect(() => hammingDistance("abc", "ab")).toThrow(RangeError);
  });
});
