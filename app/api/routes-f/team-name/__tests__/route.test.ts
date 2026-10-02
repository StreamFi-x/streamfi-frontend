import { generateTeamNames } from "../route";

describe("generateTeamNames", () => {
  it("returns the requested count", () => {
    expect(generateTeamNames(5, 42, "fierce")).toHaveLength(5);
    expect(generateTeamNames(1, 7, "funny")).toHaveLength(1);
  });

  it("is deterministic for a given seed", () => {
    expect(generateTeamNames(4, 42, "classic")).toEqual(
      generateTeamNames(4, 42, "classic"),
    );
  });

  it("differs across seeds", () => {
    expect(generateTeamNames(4, 1, "classic")).not.toEqual(
      generateTeamNames(4, 2, "classic"),
    );
  });

  it("uses the requested style's adjective pool", () => {
    const funnyAdjectives = ["Wobbly", "Sneaky", "Spicy", "Clumsy", "Hangry", "Derpy", "Sleepy", "Cheeky"];
    for (const name of generateTeamNames(10, 99, "funny")) {
      const adjective = name.split(" ")[0];
      expect(funnyAdjectives).toContain(adjective);
    }
  });
});
