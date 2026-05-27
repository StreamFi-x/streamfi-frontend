import { extractInitials } from "../route";

describe("extractInitials", () => {
  it("handles a single name", () => {
    expect(extractInitials("John")).toBe("J");
  });
  it("handles two words", () => {
    expect(extractInitials("John Smith")).toBe("JS");
  });
  it("caps at max for three words", () => {
    expect(extractInitials("John Michael Smith")).toBe("JM");
    expect(extractInitials("John Michael Smith", 3)).toBe("JMS");
  });
  it("treats hyphenated names as separate parts", () => {
    expect(extractInitials("Mary-Jane Watson")).toBe("MJ");
  });
  it("uppercases and ignores extra whitespace", () => {
    expect(extractInitials("  ada   lovelace  ")).toBe("AL");
  });
});
