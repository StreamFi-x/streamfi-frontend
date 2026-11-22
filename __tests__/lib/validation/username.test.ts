/**
 * @jest-environment node
 */
import {
  UsernameValidationError,
  normalizeUsername,
  prepareUsername,
  usernameSkeleton,
} from "@/lib/validation/username";

// Deliberately chosen confusable pair: Latin "a" (U+0061) and Cyrillic "a" (U+0430).
const LATIN_A = "a";
const CYRILLIC_A = "\u0430";

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  Alice ")).toBe("alice");
  });

  it("folds fullwidth compatibility forms with NFKC", () => {
    expect(normalizeUsername("\uff21\uff4c\uff49\uff43\uff45")).toBe("alice");
  });

  it("composes decomposed accents into one canonical form", () => {
    expect(normalizeUsername("cafe\u0301")).toBe(
      normalizeUsername("caf\u00e9")
    );
  });
});

describe("usernameSkeleton", () => {
  it("maps a Cyrillic homoglyph to the same skeleton as the Latin name", () => {
    expect(CYRILLIC_A).not.toBe(LATIN_A);
    expect(usernameSkeleton(`${CYRILLIC_A}lice`)).toBe(
      usernameSkeleton("alice")
    );
  });

  it("maps all-Cyrillic look-alikes of a Latin name onto it", () => {
    // c, o, p, e, a -> "copea"
    expect(usernameSkeleton("\u0441\u043e\u0440\u0435\u0430")).toBe("copea");
  });

  it("maps Greek omicron onto Latin o", () => {
    expect(usernameSkeleton("g\u03bf\u03bf\u0261le")).toBe("google");
  });

  it("leaves ASCII untouched, so unrelated names do not collide", () => {
    expect(usernameSkeleton("rn")).toBe("rn");
    expect(usernameSkeleton("m")).toBe("m");
    expect(usernameSkeleton("bob_99")).toBe("bob_99");
  });
});

describe("prepareUsername", () => {
  it("returns the canonical username and its skeleton", () => {
    expect(prepareUsername(" Alice ")).toEqual({
      username: "alice",
      skeleton: "alice",
    });
  });

  it("gives a pure-Cyrillic look-alike the skeleton of the Latin original", () => {
    const original = prepareUsername("paypal");
    const spoof = prepareUsername(
      "\u0440\u0430\u0443\u0440\u0430l".replace("l", "\u04cf")
    );
    expect(spoof.username).not.toBe(original.username);
    expect(spoof.skeleton).toBe(original.skeleton);
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ])("rejects %s", (_label, input) => {
    expect(() => prepareUsername(input)).toThrow(UsernameValidationError);
  });

  it("rejects over-long names", () => {
    expect(() => prepareUsername("a".repeat(256))).toThrow(
      expect.objectContaining({ code: "too_long" })
    );
  });

  it.each([
    ["zero-width space", "ali\u200bce"],
    ["right-to-left override", "ali\u202ece"],
    ["inner space", "ali ce"],
    ["null byte", "ali\u0000ce"],
    ["hangul filler", "ali\u3164ce"],
  ])("rejects %s", (_label, input) => {
    expect(() => prepareUsername(input)).toThrow(
      expect.objectContaining({ code: "invalid_characters" })
    );
  });

  it("rejects mixed Latin and Cyrillic", () => {
    expect(() => prepareUsername(`${CYRILLIC_A}lice`)).toThrow(
      expect.objectContaining({ code: "mixed_script" })
    );
  });

  it("rejects mixed Latin and Greek", () => {
    expect(() => prepareUsername("g\u03bfogle")).toThrow(
      expect.objectContaining({ code: "mixed_script" })
    );
  });

  it("allows a single non-Latin script", () => {
    expect(
      prepareUsername("\u043f\u0440\u0438\u0432\u0435\u0442").username
    ).toBe("\u043f\u0440\u0438\u0432\u0435\u0442");
  });

  it("allows digits and underscores alongside Latin", () => {
    expect(prepareUsername("Neo_2099").username).toBe("neo_2099");
  });
});
