import { lookupContinent } from "../route";

describe("lookupContinent", () => {
  it("maps countries across several continents", () => {
    expect(lookupContinent("NG")).toEqual({
      country: "Nigeria",
      continent: "Africa",
      region: "Western Africa",
    });
    expect(lookupContinent("JP")?.continent).toBe("Asia");
    expect(lookupContinent("BR")?.continent).toBe("South America");
    expect(lookupContinent("DE")?.continent).toBe("Europe");
    expect(lookupContinent("AU")?.continent).toBe("Oceania");
    expect(lookupContinent("US")?.continent).toBe("North America");
  });

  it("is case-insensitive", () => {
    expect(lookupContinent("ng")?.country).toBe("Nigeria");
  });

  it("returns null for an unknown code", () => {
    expect(lookupContinent("ZZ")).toBeNull();
  });
});
