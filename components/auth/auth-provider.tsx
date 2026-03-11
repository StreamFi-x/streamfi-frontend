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
import { usePrivy } from "@privy-io/react-auth";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import type { User, UserUpdateInput } from "@/types/user";
import { useUserProfile } from "@/hooks/useUserProfile";

const SESSION_REFRESH_INTERVAL = 30 * 60 * 1000;

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  isError: boolean;
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
  isError: false,
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
  // Persisted to sessionStorage so page reloads don't re-fire createSession().
  // Without this, every reload would call disconnect() + clearSessionCookies() again.
  const privySessionCreated = useRef(
    typeof window !== "undefined" &&
      sessionStorage.getItem("privy_session_created") === "1"
  );
  const walletSessionRef = useRef<string | null>(null);
  // Tracks the last time we successfully POSTed to /api/auth/wallet-session.
  // Used to rate-limit all callers (interval, activity events) to at most
  // one POST per SESSION_REFRESH_INTERVAL regardless of how often they fire.
  const lastRefreshedRef = useRef<number>(0);

  const router = useRouter();
  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    user: privyUser,
    getAccessToken,
    logout: privyLogout,
  } = usePrivy();
  const {
    address,
    isConnected,
    disconnect,
    isLoading: isStellarLoading,
  } = useStellarWallet();

  const {
    user: swrUser,
    isLoading: swrLoading,
    isError: swrError,
    mutate: mutateUser,
  } = useUserProfile(address ?? undefined);

  const user = swrUser !== undefined ? (swrUser ?? null) : localUser;

  const WALLET_CONNECTION_KEY = "stellar_last_wallet";
  const WALLET_AUTO_CONNECT_KEY = "stellar_auto_connect";

  // ── Privy → server session ───────────────────────────────────────────────
  // When Privy authenticates a user, exchange their short-lived JWT for a
  // server-verified HttpOnly session cookie. We do this once per login.
  useEffect(() => {
    if (!privyReady || !privyAuthenticated || !privyUser) {
      return;
    }
    if (privySessionCreated.current) {
      return;
    }

    const createSession = async () => {
      try {
        // getAccessToken returns the Privy JWT — we send it to our server
        // which verifies it with Privy's SDK before issuing our own cookie.
        const token = await getAccessToken();
        if (!token) {
          return;
        }

        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include", // receive the HttpOnly cookie
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // 409 = email already claimed by a wallet account — force Privy logout
          // and surface the message so the user knows what happened.
          if (res.status === 409) {
            privySessionCreated.current = false;
            void privyLogout();
            setError(
              body.error ??
                "This email is already associated with a wallet account."
            );
          } else {
            console.error(
              "[AuthProvider] Session creation failed:",
              res.status
            );
          }
          return;
        }

        const data = await res.json();
        privySessionCreated.current = true;
        sessionStorage.setItem("privy_session_created", "1");

        // A fresh Privy session must not inherit a previous wallet-connect identity
        disconnect();
        await clearSessionCookies();
        localStorage.removeItem(WALLET_CONNECTION_KEY);
        localStorage.removeItem(WALLET_AUTO_CONNECT_KEY);
        sessionStorage.removeItem("userData");

        // Persist non-sensitive user info to sessionStorage for fast access
        if (data.user) {
          sessionStorage.setItem("privy_user", JSON.stringify(data.user));
          if (data.user.username) {
            sessionStorage.setItem("username", data.user.username);
          }
        }

        // Notify stellar-wallet-context so the navbar updates immediately
        window.dispatchEvent(
          new CustomEvent("privy-wallet-set", { detail: { user: data.user } })
        );

        // If onboarding isn't complete, redirect to finish it
        if (data.needsOnboarding) {
          router.push("/onboarding");
        }
      } catch (err) {
        // Use warn not error — the overlay only surfaces console.error calls
        console.warn("[AuthProvider] Failed to create Privy session:", err);
      }
    };

    void createSession();
  }, [privyReady, privyAuthenticated, privyUser, getAccessToken, router]);

  // Reset the flag when the user logs out of Privy
  useEffect(() => {
    if (privyReady && !privyAuthenticated) {
      privySessionCreated.current = false;
      sessionStorage.removeItem("privy_session_created");
      sessionStorage.removeItem("privy_user");
    }
  }, [privyReady, privyAuthenticated]);

  const setSessionCookies = async (walletAddress: string) => {
    try {
      // Stamp the time immediately so any concurrent caller (activity event,
      // interval, SWR effect) sees a fresh timestamp and skips its own POST.
      lastRefreshedRef.current = Date.now();
      // Issue a server-signed HttpOnly cookie — no client-side document.cookie write
      await fetch("/api/auth/wallet-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wallet: walletAddress }),
      });
      // Keep non-sensitive client-side copies for fast reads
      localStorage.setItem("wallet", walletAddress);
      sessionStorage.setItem("wallet", walletAddress);
    } catch (setError) {
      console.error("[AuthProvider] Error setting session cookies:", setError);
    }
  };

  const clearSessionCookies = async () => {
    // Expire the legacy raw wallet cookie (still present in old sessions)
    document.cookie =
      "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
    // Expire the new signed wallet_session cookie server-side
    await fetch("/api/auth/wallet-session", {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {}); // best-effort on logout
    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
  };

  const clearUserData = async (walletAddress?: string | null) => {
    if (walletAddress) {
      localStorage.removeItem(`user_${walletAddress}`);
      localStorage.removeItem(`user_timestamp_${walletAddress}`);
    }
    sessionStorage.removeItem("userData");
    await clearSessionCookies();
  };

  const clearAllData = () => {
    // Expire legacy raw cookie client-side
    document.cookie =
      "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
    // Expire signed wallet_session cookie server-side (fire-and-forget)
    void fetch("/api/auth/wallet-session", {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
    localStorage.removeItem(WALLET_CONNECTION_KEY);
    localStorage.removeItem(WALLET_AUTO_CONNECT_KEY);
    localStorage.removeItem("stellar_address");
    sessionStorage.removeItem("userData");
    sessionStorage.removeItem("username");
  };

  useEffect(() => {
    if (swrUser && address && walletSessionRef.current !== address) {
      walletSessionRef.current = address;
      void setSessionCookies(address);
    }
    // swrUser intentionally omitted — it creates a new reference on every SWR poll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const logout = () => {
    void disconnect();
    // Clear Privy session cookie server-side
    void fetch("/api/auth/session", {
      method: "DELETE",
      credentials: "include",
    });
    // Sign out of Privy
    if (privyAuthenticated) {
      void privyLogout();
    }
    privySessionCreated.current = false;
    sessionStorage.removeItem("privy_session_created");
    // Reset session refs so a re-login always gets a fresh cookie POST
    walletSessionRef.current = null;
    lastRefreshedRef.current = 0;
    setLocalUser(null);
    clearAllData();
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("privy_user");
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
      // Guard against re-firing when only isStellarLoading toggles
      if (walletSessionRef.current !== address) {
        walletSessionRef.current = address;
        void setSessionCookies(address);
      }
    } else if (!isConnected) {
      // Reset ref so a reconnect with the same address gets a fresh session
      walletSessionRef.current = null;
      setLocalUser(null);
      void clearUserData(address ?? undefined);
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
        console.error(
          "[AuthProvider] Error initializing authentication:",
          authError
        );
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

    if (!walletAddress || !isConnected) {
      return;
    }

    // Hard rate-limit: regardless of how many times this is called (activity
    // events fire on every mousemove/keydown/scroll) only POST when at least
    // SESSION_REFRESH_INTERVAL has elapsed since the last successful POST.
    if (Date.now() - lastRefreshedRef.current < SESSION_REFRESH_INTERVAL) {
      return;
    }

    void setSessionCookies(walletAddress);
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
        isError: !!swrError,
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
      {/* Email-conflict error banner — shown when a Privy email is already
          claimed by a wallet account. Auto-dismisses after 8s. */}
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-full px-4">
          <div className="bg-destructive text-destructive-foreground text-sm rounded-lg px-4 py-3 shadow-lg flex items-start gap-3">
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="shrink-0 opacity-70 hover:opacity-100 transition-opacity text-base leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
