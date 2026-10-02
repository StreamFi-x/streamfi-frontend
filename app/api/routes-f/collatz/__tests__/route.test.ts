import { collatz } from "../route";

describe("collatz", () => {
  it("returns the trivial sequence for n=1", () => {
    expect(collatz(1)).toEqual({ sequence: [1], steps: 0, max_value: 1 });
  });

  it("matches the known sequence for n=27 (111 steps, max 9232)", () => {
    const r = collatz(27);
    expect(r.steps).toBe(111);
    expect(r.max_value).toBe(9232);
    expect(r.sequence[0]).toBe(27);
    expect(r.sequence[r.sequence.length - 1]).toBe(1);
    expect(r.sequence.length).toBe(112); // steps + the starting value
  });

  it("handles a small even start (n=6)", () => {
    expect(collatz(6).sequence).toEqual([6, 3, 10, 5, 16, 8, 4, 2, 1]);
  });
});
