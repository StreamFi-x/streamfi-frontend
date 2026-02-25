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
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import type { User, UserUpdateInput } from "@/types/user";
import { useUserProfile } from "@/hooks/useUserProfile";

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
const SESSION_REFRESH_INTERVAL = 30 * 60 * 1000;

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
  const { address, isConnected, disconnect, isLoading: isStellarLoading } =
    useStellarWallet();

  const {
    user: swrUser,
    isLoading: swrLoading,
    mutate: mutateUser,
  } = useUserProfile(address ?? undefined);

  const user = swrUser !== undefined ? (swrUser ?? null) : localUser;

  const WALLET_CONNECTION_KEY = "stellar_last_wallet";
  const WALLET_AUTO_CONNECT_KEY = "stellar_auto_connect";

  const setSessionCookies = (walletAddress: string) => {
    try {
      document.cookie = `wallet=${walletAddress}; path=/; max-age=${SESSION_TIMEOUT / 1000}; SameSite=Lax`;
      localStorage.setItem("wallet", walletAddress);
      sessionStorage.setItem("wallet", walletAddress);
    } catch (setError) {
      console.error("[AuthProvider] Error setting session cookies:", setError);
    }
  };

  const clearSessionCookies = () => {
    document.cookie =
      "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
  };

  const clearUserData = (walletAddress?: string | null) => {
    if (walletAddress) {
      localStorage.removeItem(`user_${walletAddress}`);
      localStorage.removeItem(`user_timestamp_${walletAddress}`);
    }
    sessionStorage.removeItem("userData");
    clearSessionCookies();
  };

  const clearAllData = () => {
    document.cookie =
      "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
    localStorage.removeItem(WALLET_CONNECTION_KEY);
    localStorage.removeItem(WALLET_AUTO_CONNECT_KEY);
    sessionStorage.removeItem("userData");
    sessionStorage.removeItem("username");
  };

  useEffect(() => {
    if (swrUser && address) {
      setSessionCookies(address);
    }
  }, [swrUser, address]);

  const logout = () => {
    void disconnect();
    setLocalUser(null);
    clearAllData();
    sessionStorage.removeItem("username");
    router.push("/");
  };

  useEffect(() => {
    if (isStellarLoading) {
      setIsWalletConnecting(true);
      return;
    }

    setIsWalletConnecting(false);

    if (isConnected && address) {
      localStorage.setItem(WALLET_AUTO_CONNECT_KEY, "true");
      setSessionCookies(address);
    } else if (!isConnected) {
      setLocalUser(null);
      clearUserData(address ?? undefined);
    }
  }, [isConnected, address, isStellarLoading]);

  useEffect(() => {
    const initAuth = () => {
      try {
        const shouldAutoConnect =
          localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true";
        const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY);

        if (!shouldAutoConnect || !lastWalletId || isConnected) {
          setIsInitializing(false);
          setHasInitialized(true);
        }
      } catch (authError) {
        console.error("[AuthProvider] Error initializing authentication:", authError);
        setError("Failed to initialize authentication");
        setIsInitializing(false);
        setHasInitialized(true);
      }
    };

    const timer = setTimeout(initAuth, 500);
    return () => clearTimeout(timer);
  }, [isConnected]);

  useEffect(() => {
    const shouldAutoConnect =
      localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true";
    const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY);

    if (shouldAutoConnect && lastWalletId && isInitializing) {
      const timeout = setTimeout(() => {
        console.log("[AuthProvider] Auto-connect timeout - stopping loading");
        setIsInitializing(false);
        setHasInitialized(true);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [isInitializing]);

  useEffect(() => {
    if (hasInitialized) {
      return;
    }

    const shouldAutoConnect =
      localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true";
    const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY);

    if (shouldAutoConnect && lastWalletId) {
      if (isConnected && address) {
        setIsInitializing(false);
        setHasInitialized(true);
      } else if (!isConnected && !isStellarLoading && !isWalletConnecting) {
        const timeSinceMount = Date.now() - mountTime.current;
        const maxAutoConnectTime = 10000;

        if (timeSinceMount > maxAutoConnectTime) {
          setIsInitializing(false);
          setHasInitialized(true);
        }
      }
    } else if (!shouldAutoConnect || !lastWalletId) {
      setIsInitializing(false);
      setHasInitialized(true);
    }

    if (isInitializing && !hasInitialized) {
      const timeSinceMount = Date.now() - mountTime.current;
      if (timeSinceMount > 15000) {
        setIsInitializing(false);
        setHasInitialized(true);
      }
    }
  }, [
    isConnected,
    address,
    isStellarLoading,
    isWalletConnecting,
    hasInitialized,
    isInitializing,
  ]);

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

  useEffect(() => {
    const handleUserActivity = () => {
      if (user && isConnected) {
        refreshSession();
      }
    };

    const events = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "visibilitychange",
    ];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user, isConnected, refreshSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: swrLoading,
        isInitializing,
        error,
        logout,
        refreshUser: async () => {
          const result = await mutateUser();
          return result ?? null;
        },
        updateUserProfile: async (userData: UserUpdateInput) => {
          if (!user) {
            return false;
          }

          try {
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
            if (userData.avatar && userData.avatar instanceof File) {
              formData.append("avatar", userData.avatar);
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

              await mutateUser(updatedUser, false);

              localStorage.setItem(
                `user_${user.wallet}`,
                JSON.stringify(updatedUser)
              );
              localStorage.setItem(
                `user_timestamp_${user.wallet}`,
                Date.now().toString()
              );

              return true;
            }

            const responseError = await response.json();
            console.error("Error response from API:", responseError);
            return false;
          } catch (updateError) {
            console.error("Error updating user profile:", updateError);
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
