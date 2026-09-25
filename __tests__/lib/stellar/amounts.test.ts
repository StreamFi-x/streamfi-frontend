/**
 * @jest-environment node
 */
import { absStroops, fromStroops, toStroops } from "@/lib/stellar/amounts";

describe("stellar amounts", () => {
  it("converts decimal strings to exact stroops", () => {
    expect(toStroops("1")).toBe(BigInt(10000000));
    expect(toStroops("0.0000001")).toBe(BigInt(1));
    expect(toStroops("12.5")).toBe(BigInt(125000000));
    expect(toStroops("-3.25")).toBe(BigInt(-32500000));
  });

  it("sums without floating point error", () => {
    const sum = ["0.1", "0.2"].reduce(
      (acc, a) => acc + toStroops(a),
      BigInt(0)
    );
    expect(fromStroops(sum)).toBe("0.3000000");
    // parseFloat would give 0.30000000000000004
  });

  it("handles amounts beyond Number.MAX_SAFE_INTEGER stroops", () => {
    const big = "922337203685.4775807";
    expect(fromStroops(toStroops(big))).toBe(big);
  });

  it("formats with 7 decimals and sign", () => {
    expect(fromStroops(BigInt(1))).toBe("0.0000001");
    expect(fromStroops(BigInt(-15))).toBe("-0.0000015");
    expect(absStroops(BigInt(-5))).toBe(BigInt(5));
  });

  it("rejects malformed and over-precise amounts", () => {
    expect(() => toStroops("1.00000001")).toThrow();
    expect(() => toStroops("abc")).toThrow();
    expect(() => toStroops("1e5")).toThrow();
  });
});
