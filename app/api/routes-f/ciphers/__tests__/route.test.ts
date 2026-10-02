import {
  atbash,
  railFenceEncode,
  railFenceDecode,
} from "../route";

describe("atbash", () => {
  it("mirrors letters and is its own inverse", () => {
    expect(atbash("abc")).toBe("zyx");
    expect(atbash("Hello")).toBe("Svool");
    expect(atbash(atbash("Round Trip!"))).toBe("Round Trip!");
  });

  it("leaves non-letters untouched", () => {
    expect(atbash("a1 b2")).toBe("z1 y2");
  });
});

describe("rail fence", () => {
  it("encodes with the classic zig-zag", () => {
    // "WEAREDISCOVEREDFLEEATONCE" with 3 rails -> known result
    expect(railFenceEncode("WEAREDISCOVEREDFLEEATONCE", 3)).toBe(
      "WECRLTEERDSOEEFEAOCAIVDEN",
    );
  });

  it("round-trips encode -> decode for several rail counts", () => {
    const text = "the quick brown fox";
    for (const rails of [2, 3, 4, 5]) {
      expect(railFenceDecode(railFenceEncode(text, rails), rails)).toBe(text);
    }
  });
});
