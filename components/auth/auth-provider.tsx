"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "@starknet-react/core";
import { User, UserUpdateInput } from "@/types/user";
import { useUserProfile } from "@/hooks/useUserProfile";

// Session timeout in milliseconds (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
const SESSION_REFRESH_INTERVAL = 30 * 60 * 1000; // Refresh every 30 minutes

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  logout: () => void;
  refreshUser: (walletAddress?: string) => Promise<User | null>;
  updateUserProfile: (userData: UserUpdateInput) => Promise<boolean>;
  isWalletConnecting: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isInitializing: true,
  error: null,
  logout: () => {},
  refreshUser: async () => null,
  updateUserProfile: async () => false,
  isWalletConnecting: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const mountTime = useRef(Date.now());

  const router = useRouter();
  const { address, isConnected, status } = useAccount();
  const { disconnect } = useDisconnect();

  // Use optimized SWR hook for user profile fetching
  const {
    user: swrUser,
    isLoading: swrLoading,
    mutate: mutateUser,
  } = useUserProfile(address);

  // Compute effective user directly from SWR data (no useEffect delay)
  // This ensures `user` and `isLoading` update in the SAME render cycle
  const user = swrUser !== undefined ? (swrUser ?? null) : localUser;

  // Wallet connection persistence
  const WALLET_CONNECTION_KEY = "starknet_last_wallet";
  const WALLET_AUTO_CONNECT_KEY = "starknet_auto_connect";

  const setSessionCookies = (walletAddress: string) => {
    try {
      document.cookie = `wallet=${walletAddress}; path=/; max-age=${SESSION_TIMEOUT / 1000}; SameSite=Lax`;
      localStorage.setItem("wallet", walletAddress);
      sessionStorage.setItem("wallet", walletAddress);
    } catch (error) {
      console.error("[AuthProvider] Error setting session cookies:", error);
    }
  };

  const clearSessionCookies = () => {
    document.cookie =
      "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
    // Don't clear StarkNet auto-connect data - this breaks auto-connect
    // localStorage.removeItem(WALLET_CONNECTION_KEY)
    // localStorage.removeItem(WALLET_AUTO_CONNECT_KEY)
  };

  const clearUserData = (walletAddress?: string) => {
    if (walletAddress) {
      localStorage.removeItem(`user_${walletAddress}`);
      localStorage.removeItem(`user_timestamp_${walletAddress}`);
    }
    sessionStorage.removeItem("userData");
    clearSessionCookies();
  };

  const clearAllData = () => {
    // This is for logout - clear everything including auto-connect
    document.cookie =
      "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
    localStorage.removeItem(WALLET_CONNECTION_KEY);
    localStorage.removeItem(WALLET_AUTO_CONNECT_KEY);
    sessionStorage.removeItem("userData");
    sessionStorage.removeItem("username");
  };

  // Set session cookies when SWR resolves user data
  useEffect(() => {
    if (swrUser && address) {
      setSessionCookies(address);
    }
  }, [swrUser, address]);

  const logout = () => {
    // Disconnect wallet
    disconnect();

    // Clear local user state
    setLocalUser(null);

    // Clear all data including auto-connect (user explicitly logged out)
    clearAllData();
    sessionStorage.removeItem("username");

    // Navigate to home
    router.push("/");
  };

  // Handle wallet connection changes
  useEffect(() => {
    if (status === "connecting") {
      setIsWalletConnecting(true);
      return;
    }

    setIsWalletConnecting(false);

    if (isConnected && address) {
      // Store the address for auto-connect - let StarkNet handle connector detection
      localStorage.setItem("starknet_last_wallet", "auto");
      localStorage.setItem("starknet_auto_connect", "true");
      setSessionCookies(address);
      // SWR will automatically fetch user data via useUserProfile hook
    } else if (status === "disconnected") {
      setLocalUser(null);
      clearUserData(address);
    }
  }, [isConnected, address, status]);

  // Initialize auth on app start
  useEffect(() => {
    const initAuth = () => {
      try {
        // Check if auto-connect is enabled
        const shouldAutoConnect =
          localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true";
        const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY);

        // SWR will automatically fetch user data when address is available
        // Just handle initialization state
        if (!shouldAutoConnect || !lastWalletId || isConnected) {
          setIsInitializing(false);
          setHasInitialized(true);
        }
      } catch (err) {
        console.error("[AuthProvider] Error initializing authentication:", err);
        setError("Failed to initialize authentication");
        setIsInitializing(false);
        setHasInitialized(true);
      }
    };

    // Add a delay to ensure StarkNet provider is ready
    const timer = setTimeout(initAuth, 500);
    return () => clearTimeout(timer);
  }, []);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const shouldAutoConnect =
      localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true";
    const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY);

    if (shouldAutoConnect && lastWalletId && isInitializing) {
      // Set a timeout to prevent infinite loading (10 seconds)
      const timeout = setTimeout(() => {
        console.log(
          "[AuthProvider] ⏰ Auto-connect timeout - stopping loading"
        );
        setIsInitializing(false);
        setHasInitialized(true);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [isInitializing]);

  // Handle auto-connect completion
  useEffect(() => {
    if (hasInitialized) {
      return;
    }

    const shouldAutoConnect =
      localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true";
    const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY);

    // If auto-connect is enabled and we have a last wallet, wait for connection
    if (shouldAutoConnect && lastWalletId) {
      if (isConnected && address) {
        setIsInitializing(false);
        setHasInitialized(true);
      } else if (status === "disconnected" && !isWalletConnecting) {
        // Give auto-connect more time (up to 10 seconds)
        const timeSinceMount = Date.now() - mountTime.current;
        const maxAutoConnectTime = 10000; // 10 seconds

        if (timeSinceMount > maxAutoConnectTime) {
          setIsInitializing(false);
          setHasInitialized(true);
        }
      }
    } else if (!shouldAutoConnect || !lastWalletId) {
      // If auto-connect is not enabled, finish initialization immediately
      setIsInitializing(false);
      setHasInitialized(true);
    }

    // Emergency fallback: if we've been waiting too long, finish initialization
    if (isInitializing && !hasInitialized) {
      const timeSinceMount = Date.now() - mountTime.current;
      if (timeSinceMount > 15000) {
        // 15 seconds total
        setIsInitializing(false);
        setHasInitialized(true);
      }
    }
  }, [
    isConnected,
    address,
    status,
    isWalletConnecting,
    hasInitialized,
    isInitializing,
  ]);

  // Refresh session periodically
  const refreshSession = useCallback(() => {
    const storedWallet = localStorage.getItem("wallet");
    const sessionWallet = sessionStorage.getItem("wallet");
    const walletAddress = address || storedWallet || sessionWallet;

    if (walletAddress && isConnected) {
      setSessionCookies(walletAddress);
    }
  }, [address, isConnected]);

  useEffect(() => {
    if (user && isConnected) {
      const interval = setInterval(refreshSession, SESSION_REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [user, isConnected, refreshSession]);

  // Handle user activity for session refresh
  useEffect(() => {
    const handleUserActivity = () => {
      if (user && isConnected) {
        refreshSession();
      }
    };

    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user, isConnected, refreshSession]);

  // Track page visibility changes (reloads, tab switches, etc.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log("[AuthProvider] 📄 Page visibility changed:", {
        hidden: document.hidden,
        timestamp: new Date().toISOString(),
        walletState: {
          isConnected,
          address,
          status,
        },
        storageState: {
          localStorage: {
            wallet: localStorage.getItem("wallet"),
            starknet_last_wallet: localStorage.getItem("starknet_last_wallet"),
            starknet_auto_connect: localStorage.getItem(
              "starknet_auto_connect"
            ),
          },
          sessionStorage: {
            wallet: sessionStorage.getItem("wallet"),
            userData: sessionStorage.getItem("userData") ? "exists" : "null",
          },
        },
      });
    };

    const handleBeforeUnload = () => {
      console.log("[AuthProvider] 🔄 Page unloading - wallet state:", {
        isConnected,
        address,
        status,
        timestamp: new Date().toISOString(),
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isConnected, address, status]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: swrLoading,
        isInitializing,
        error,
        logout,
        refreshUser: async () => {
          // Use SWR mutate to refetch user data
          await mutateUser();
          return user;
        },
        updateUserProfile: async (userData: UserUpdateInput) => {
          if (!user) {
            return false;
          }

          try {
            // Create FormData for file upload support
            const formData = new FormData();

            if (userData.username) {
              formData.append("username", userData.username);
            }
            if (userData.email) {
              formData.append("email", userData.email);
            }
            if (userData.bio) {
              formData.append("bio", userData.bio);
            }
            if (userData.streamkey) {
              formData.append("streamkey", userData.streamkey);
            }
            if (userData.avatar) {
              // Avatar can be File or string URL
              if (userData.avatar instanceof File) {
                formData.append("avatar", userData.avatar);
              }
              // If it's a URL string, we don't need to send it (already stored)
            }
            if (userData.socialLinks) {
              formData.append(
                "socialLinks",
                JSON.stringify(userData.socialLinks)
              );
            }
            if (userData.creator) {
              formData.append("creator", JSON.stringify(userData.creator));
            }

            const response = await fetch(`/api/users/updates/${user.wallet}`, {
              method: "PUT",
              body: formData,
            });

            if (response.ok) {
              const result = await response.json();
              const updatedUser = result.user;

              // Update SWR cache directly (no revalidation needed)
              await mutateUser(updatedUser, false);

              // Update local cached data
              localStorage.setItem(
                `user_${user.wallet}`,
                JSON.stringify(updatedUser)
              );
              localStorage.setItem(
                `user_timestamp_${user.wallet}`,
                Date.now().toString()
              );

              return true;
            } else {
              const errorData = await response.json();
              console.error("Error response from API:", errorData);
              return false;
            }
          } catch (err) {
            console.error("Error updating user profile:", err);
            return false;
          }
        },
        isWalletConnecting,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
