import fs from "fs";
import path from "path";
import {
  STATIC_APP_ROUTES,
  RESERVED_USERNAMES,
  isReservedUsername,
  getReservedUsernameError,
} from "../reserved-usernames";
import {
  validateUserRegistration,
  validateUserUpdate,
} from "@/utils/userValidators";

describe("reserved-usernames blocklist (#1726)", () => {
  it("blocks every static top-level route directory in app/", () => {
    const appDir = path.join(process.cwd(), "app");
    const entries = fs.readdirSync(appDir, { withFileTypes: true });

    const staticRouteDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(
        name =>
          !name.startsWith("(") && // Next.js route groups
          !name.startsWith("[") && // Dynamic segments like [username]
          !name.startsWith("_") // Private folders
      );

    expect(staticRouteDirs.length).toBeGreaterThan(0);

    for (const route of staticRouteDirs) {
      expect(STATIC_APP_ROUTES).toContain(route);
      expect(isReservedUsername(route)).toBe(true);
      const err = getReservedUsernameError(route);
      expect(err).toMatch(/reserved/i);
      expect(err).toMatch(/application route/i);
    }
  });

  it("matches reserved words case-insensitively and ignores surrounding whitespace", () => {
    expect(isReservedUsername("SETTINGS")).toBe(true);
    expect(isReservedUsername("Dashboard")).toBe(true);
    expect(isReservedUsername("  Admin  ")).toBe(true);
    expect(isReservedUsername("EXPLORE")).toBe(true);
    expect(isReservedUsername("Browse")).toBe(true);
    expect(isReservedUsername("API")).toBe(true);
  });

  it("blocks reserved system and platform terms", () => {
    for (const term of [
      "streamfi",
      "support",
      "help",
      "login",
      "signup",
      "wallet",
    ]) {
      expect(RESERVED_USERNAMES.has(term)).toBe(true);
      expect(isReservedUsername(term)).toBe(true);
      expect(getReservedUsernameError(term)).toMatch(/reserved/i);
    }
  });

  it("allows normal, non-reserved usernames", () => {
    for (const handle of [
      "alice",
      "stellar_streamer",
      "pro_gamer_99",
      "my_dashboard_fan",
      "settings_guru",
    ]) {
      expect(isReservedUsername(handle)).toBe(false);
      expect(getReservedUsernameError(handle)).toBeNull();
    }
  });

  it("handles empty or non-string inputs safely", () => {
    expect(isReservedUsername("")).toBe(false);
    expect(isReservedUsername("   ")).toBe(false);
    expect(getReservedUsernameError("")).toBeNull();
  });

  describe("integration with userValidators", () => {
    it("rejects reserved usernames during registration", () => {
      const result = validateUserRegistration({
        email: "alice@example.com",
        username: "settings",
        wallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/reserved/i);
    });

    it("allows non-reserved usernames during registration", () => {
      const result = validateUserRegistration({
        email: "alice@example.com",
        username: "alice_live",
        wallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      });
      expect(result.isValid).toBe(true);
    });

    it("rejects reserved usernames during profile update", () => {
      const result = validateUserUpdate({ username: "dashboard" });
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/reserved/i);
    });

    it("allows profile updates with non-reserved usernames", () => {
      const result = validateUserUpdate({ username: "alice_streams" });
      expect(result.isValid).toBe(true);
    });
  });
});
