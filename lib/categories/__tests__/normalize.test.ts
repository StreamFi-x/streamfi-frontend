import { normalizeCategoryKey } from "../normalize";

describe("normalizeCategoryKey", () => {
  it("collapses case, spacing and punctuation variants to the same key", () => {
    const variants = [
      "Speedrunning",
      "speedrunning",
      "Speed Running",
      "speed-running",
      "  Speed   Running  ",
      "Speed_Running!",
    ];
    const keys = new Set(variants.map(normalizeCategoryKey));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe("speedrunning");
  });

  it("strips accents", () => {
    expect(normalizeCategoryKey("Café Talk")).toBe("cafetalk");
  });

  it("does not conflate semantically different names that happen to share letters loosely", () => {
    expect(normalizeCategoryKey("Music")).not.toBe(normalizeCategoryKey("Musicals"));
  });
});
