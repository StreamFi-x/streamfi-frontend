import { calculatePasswordStrength } from "../_lib/helpers";

describe("Password Strength Utility", () => {
  test("Score 0: Known bad password", () => {
    const res = calculatePasswordStrength("123456");
    expect(res.score).toBe(0);
    expect(res.estimated_crack_time).toBe("Instant");
  });

  test("Score 1: Short but unique", () => {
    const res = calculatePasswordStrength("abcd123!");
    expect(res.score).toBe(1);
  });

  test("Score 2: Long but low variety", () => {
    const res = calculatePasswordStrength("onlylowercaselengthy");
    expect(res.score).toBe(2);
  });

  test("Score 3: Good variety, medium length", () => {
    const res = calculatePasswordStrength("Abc123!Safe");
    expect(res.score).toBe(3);
  });

  test("Score 4: Excellent variety and length", () => {
    const res = calculatePasswordStrength("X@7yP9!q2Z_Longer");
    expect(res.score).toBe(4);
    expect(res.estimated_crack_time).toBe("Years");
  });
});