/**
 * Development mode utilities
 * Used to bypass authentication for frontend development
 */

export const DEV_MODE =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_MODE === "true";

// Test user for development
export const DEV_TEST_USER = {
  wallet: "0x04fef7247897775ee856f4a2c52b460300b67306c14a200ce71eb1f9190a388e",
  username: "test_user",
  id: "dev-user-id",
};

/**
 * Get wallet from request or use test wallet in dev mode
 */
export function getWalletOrDevDefault(
  wallet: string | null | undefined
): string {
  if (DEV_MODE && !wallet) {
    console.log("🔧 DEV_MODE: Using test wallet");
    return DEV_TEST_USER.wallet;
  }
  return wallet || "";
}

/**
 * Check if auth should be bypassed
 */
export function shouldBypassAuth(): boolean {
  return DEV_MODE;
}

/**
 * Get user ID for development mode
 */
export function getDevUserId(): string | null {
  return DEV_MODE ? DEV_TEST_USER.id : null;
}
