"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "@starknet-react/core";
import SimpleLoader from "@/components/ui/loader/simple-loader";

// Define user type
type User = {
  id: string;
  username: string;
  email: string;
  wallet: string;
  avatar?: string;
  bio?: string;
  socialLinks?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  streamkey?: string;
};

// Session timeout in milliseconds (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
const SESSION_REFRESH_INTERVAL = 30 * 60 * 1000; // Refresh every 30 minutes

// Protected routes that require authentication
const PROTECTED_ROUTES = ["/settings", "/dashboard"];

// Define auth context type
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  logout: () => void;
  refreshUser: (walletAddress?: string) => Promise<User | null>;
  updateUserProfile: (userData: Partial<User>) => Promise<boolean>;
};

// Create auth context
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isInitializing: true,
  error: null,
  logout: () => {},
  refreshUser: async () => null,
  updateUserProfile: async () => false,
});

// Hook to use auth context
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const router = useRouter();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // Check if session is valid
  const isSessionValid = (timestamp: number) => {
    return Date.now() - timestamp < SESSION_TIMEOUT;
  };

  // Set session cookies
  const setSessionCookies = (walletAddress: string) => {
    const timestamp = Date.now().toString();
    document.cookie = `wallet=${walletAddress}; path=/; max-age=${SESSION_TIMEOUT / 1000}`;
    document.cookie = `wallet_timestamp=${timestamp}; path=/; max-age=${SESSION_TIMEOUT / 1000}`;
  };

  // Clear session cookies
  const clearSessionCookies = () => {
    document.cookie = "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "wallet_timestamp=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  };

  // Fetch user data from API or cache
  const fetchUserData = async (walletAddress?: string): Promise<User | null> => {
    if (!walletAddress) {
      walletAddress = address || localStorage.getItem("wallet") || sessionStorage.getItem("wallet") || undefined;
      if (!walletAddress) return null;
    }

    try {
      setError(null);
      setIsLoading(true);

      // Check for cached user data
      const cachedUserData = localStorage.getItem(`user_${walletAddress}`);
      const cachedTimestamp = localStorage.getItem(`user_timestamp_${walletAddress}`);

      // Use cached data if it's less than 5 minutes old and session is valid
      if (cachedUserData && cachedTimestamp) {
        const parsedUser = JSON.parse(cachedUserData);
        const timestamp = parseInt(cachedTimestamp);
        
        if (isSessionValid(timestamp)) {
          setUser(parsedUser);
          setSessionCookies(walletAddress);
          return parsedUser;
        } else {
          // Clear expired session data
          localStorage.removeItem(`user_${walletAddress}`);
          localStorage.removeItem(`user_timestamp_${walletAddress}`);
          clearSessionCookies();
        }
      }

      // Fetch from API if no valid cache
      const response = await fetch(`/api/users/${walletAddress}`);

      if (response.ok) {
        const data = await response.json();

        // Store user data
        setUser(data.user);

        // Cache user data with current timestamp
        localStorage.setItem(`user_${walletAddress}`, JSON.stringify(data.user));
        localStorage.setItem(`user_timestamp_${walletAddress}`, Date.now().toString());

        // Set session cookies
        setSessionCookies(walletAddress);

        return data.user;
      } else if (response.status === 404) {
        setUser(null);
        return null;
      } else {
        throw new Error(`Failed to fetch user data: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
      setError("Failed to load user data");
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    // Disconnect wallet
    disconnect();

    // Clear user state
    setUser(null);

    // Clear storage
    const walletToRemove = address || localStorage.getItem("wallet") || sessionStorage.getItem("wallet");
    if (walletToRemove) {
      localStorage.removeItem(`user_${walletToRemove}`);
      localStorage.removeItem(`user_timestamp_${walletToRemove}`);
    }

    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
    
    // Clear session cookies
    clearSessionCookies();

    // Redirect to home
    router.push("/");
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for wallet in storage or connected wallet
        const storedWallet = localStorage.getItem("wallet") || sessionStorage.getItem("wallet");
        const walletToUse = storedWallet || (isConnected ? address : null);

        if (walletToUse) {
          const cachedTimestamp = localStorage.getItem(`user_timestamp_${walletToUse}`);
          
          // Check if session is still valid
          if (cachedTimestamp && isSessionValid(parseInt(cachedTimestamp))) {
            await fetchUserData(walletToUse);
          } else {
            // Clear expired session
            logout();
          }
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        setError("Failed to initialize authentication");
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, []);

  // Handle wallet connection/disconnection
  useEffect(() => {
    const handleWalletChange = async () => {
      if (isConnected && address) {
        // Store wallet address
        localStorage.setItem("wallet", address);
        sessionStorage.setItem("wallet", address);

        // Set session cookies immediately
        setSessionCookies(address);

        // Fetch user data and set session
        await fetchUserData(address);
      } else if (!isConnected && user) {
        // Wallet disconnected
        logout();
      }
    };

    if (!isInitializing) {
      handleWalletChange();
    }
  }, [isConnected, address, isInitializing]);

  // Protect routes
  useEffect(() => {
    const checkAuth = async () => {
      const walletAddress = address || localStorage.getItem("wallet") || sessionStorage.getItem("wallet");
      const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
      const isExploreRoute = pathname === "/explore";

      if (!isInitializing) {
        if (isProtectedRoute) {
          // For protected routes, only redirect if there's no wallet connection
          if (!walletAddress) {
            router.push("/explore");
          } else if (!user && !isLoading) {
            // Try to fetch user data but don't redirect if it fails
            await fetchUserData(walletAddress);
          }
        } else if (isExploreRoute && walletAddress) {
          // If user is connected and on explore page, redirect to settings
          router.push("/settings");
        }
      }
    };

    // Only run the check if we're not already loading
    if (!isLoading) {
      checkAuth();
    }
  }, [pathname, user, isInitializing, isLoading, address]);

  // Refresh session
  const refreshSession = useCallback(() => {
    const storedWallet = localStorage.getItem("wallet");
    const sessionWallet = sessionStorage.getItem("wallet");
    const walletAddress = address || (storedWallet ? storedWallet : undefined) || (sessionWallet ? sessionWallet : undefined);
    if (walletAddress) {
      setSessionCookies(walletAddress);
    }
  }, [address]);

  // Set up session refresh interval
  useEffect(() => {
    if (user) {
      const interval = setInterval(refreshSession, SESSION_REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [user, refreshSession]);

  // Refresh session on user activity
  useEffect(() => {
    const handleUserActivity = () => {
      if (user) {
        refreshSession();
      }
    };

    // Add event listeners for user activity
    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("click", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
    };
  }, [user, refreshSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitializing,
        error,
        logout,
        refreshUser: fetchUserData,
        updateUserProfile: async (userData) => {
          try {
            if (!user?.wallet) return false;
            const response = await fetch(`/api/users/${user.wallet}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(userData),
            });
            if (response.ok) {
              const updatedUser = await response.json();
              setUser(updatedUser);
              return true;
            }
            return false;
          } catch (err) {
            console.error("Error updating user profile:", err);
            return false;
          }
        },
      }}
    >
      {children}
      {/* Only show loader during initial app load */}
      {isInitializing && <SimpleLoader />}
    </AuthContext.Provider>
  );
}
