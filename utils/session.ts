/**
 * Session utility functions for managing wallet sessions
 */

// Session timeout in milliseconds (2 days)
export const SESSION_TIMEOUT = 2 * 24 * 60 * 60 * 1000;

/**
 * Check if a stored session is still valid
 */
export function isSessionValid(): boolean {
  try {
    const storedWallet = localStorage.getItem("wallet");
    const timestamp = localStorage.getItem("wallet_timestamp");

    if (!storedWallet || !timestamp) {
      return false;
    }

    // Check if session is within timeout period
    return Date.now() - Number(timestamp) < SESSION_TIMEOUT;
  } catch (error) {
    console.error("[Session] Error checking session validity:", error);
    return false;
  }
}

/**
 * Store a new session
 */
export function storeSession(wallet: string, username: string): void {
  try {
    localStorage.setItem("wallet", wallet);
    localStorage.setItem("username", username);
    localStorage.setItem("wallet_timestamp", Date.now().toString());

    // Also store in sessionStorage for redundancy
    sessionStorage.setItem("wallet", wallet);
    sessionStorage.setItem("username", username);

    // Set HTTP-only style cookie
    document.cookie = `wallet=${wallet}; path=/; max-age=${SESSION_TIMEOUT / 1000}; SameSite=Lax`;
  } catch (error) {
    console.error("[Session] Error storing session:", error);
  }
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  try {
    localStorage.removeItem("wallet");
    localStorage.removeItem("username");
    localStorage.removeItem("wallet_timestamp");

    sessionStorage.removeItem("wallet");
    sessionStorage.removeItem("username");

    document.cookie =
      "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch (error) {
    console.error("[Session] Error clearing session:", error);
  }
}

/**
 * Get the current wallet from storage
 */
export function getStoredWallet(): string | null {
  try {
    const wallet = localStorage.getItem("wallet");

    if (wallet && isSessionValid()) {
      // Refresh the timestamp to extend the session
      localStorage.setItem("wallet_timestamp", Date.now().toString());
      return wallet;
    }

    // If session is invalid, clear it
    if (wallet && !isSessionValid()) {
      clearSession();
    }

    return null;
  } catch (error) {
    console.error("[Session] Error getting stored wallet:", error);
    return null;
  }
}

/**
 * Get the current username from storage
 */
export function getStoredUsername(): string | null {
  try {
    const username = localStorage.getItem("username");

    if (username && isSessionValid()) {
      return username;
    }

    return null;
  } catch (error) {
    console.error("[Session] Error getting stored username:", error);
    return null;
  }
}
