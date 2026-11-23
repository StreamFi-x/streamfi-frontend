/**
 * Tests for Privy session clearing confirmation on wallet switch (#1743)
 */

import { confirmPrivySessionClear } from "@/contexts/stellar-wallet-context";

describe("confirmPrivySessionClear (#1743)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it("returns true without prompting when no privy_user session exists", () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockImplementation();

    const result = confirmPrivySessionClear();

    expect(result).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("prompts the user with confirm dialog when privy_user exists and returns true on OK", () => {
    sessionStorage.setItem("privy_user", JSON.stringify({ id: "privy-123", username: "creator" }));
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);

    const result = confirmPrivySessionClear();

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("Connecting a new wallet will switch your active session")
    );
    expect(result).toBe(true);
  });

  it("prompts the user with confirm dialog when privy_user exists and returns false on Cancel", () => {
    sessionStorage.setItem("privy_user", JSON.stringify({ id: "privy-123", username: "creator" }));
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

    const result = confirmPrivySessionClear();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});
