"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAccount, useDisconnect } from "@starknet-react/core";
import { useRouter, usePathname } from "next/navigation";
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

// Define auth context type
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
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

// Protected routes that require authentication
const PROTECTED_ROUTES = ["/settings", "/dashboard"];

// Hook to use auth context
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const pathname = usePathname();

  // Check if current route is protected
  const isProtectedRoute = () => {
    if (!pathname) return false;
    return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  };

  // Fetch user data from API or cache
  const fetchUserData = async (walletAddress: string): Promise<User | null> => {
    try {
      setError(null);
      setIsLoading(true);

      console.log(
        "AuthProvider: Fetching user data for wallet:",
        walletAddress
      );

      // Check for cached user data
      const cachedUserData = localStorage.getItem(`user_${walletAddress}`);
      const cachedTimestamp = localStorage.getItem(
        `user_timestamp_${walletAddress}`
      );

      // Use cached data if it's less than 5 minutes old
      if (cachedUserData && cachedTimestamp) {
        const parsedUser = JSON.parse(cachedUserData);
        const timestamp = parseInt(cachedTimestamp);
        const now = Date.now();

        if (now - timestamp < 5 * 60 * 1000) {
          console.log("AuthProvider: Using cached user data");
          setUser(parsedUser);
          return parsedUser;
        }
      }

      // Fetch from API if no valid cache
      const response = await fetch(`/api/users/${walletAddress}`);

      if (response.ok) {
        const data = await response.json();
        console.log("AuthProvider: User data fetched successfully");

        // Store user data
        setUser(data.user);

        // Cache user data
        localStorage.setItem(
          `user_${walletAddress}`,
          JSON.stringify(data.user)
        );
        localStorage.setItem(
          `user_timestamp_${walletAddress}`,
          Date.now().toString()
        );

        // Store wallet address for persistence
        localStorage.setItem("wallet", walletAddress);
        sessionStorage.setItem("wallet", walletAddress);

        return data.user;
      } else if (response.status === 404) {
        console.log("AuthProvider: User not found for wallet:", walletAddress);
        setUser(null);
        return null;
      } else {
        throw new Error(`Failed to fetch user data: ${response.statusText}`);
      }
    } catch (err) {
      console.error("AuthProvider: Error fetching user data:", err);
      setError("Failed to load user data");
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = async (): Promise<User | null> => {
    // Get wallet address from connected wallet or storage
    const walletAddress =
      address ||
      localStorage.getItem("wallet") ||
      sessionStorage.getItem("wallet");

    if (!walletAddress) {
      console.log("AuthProvider: No wallet address available for refresh");
      return null;
    }

    return await fetchUserData(walletAddress);
  };

  // Update user profile
  const updateUserProfile = async (
    userData: Partial<User>
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      setIsLoading(true);

      // In a real implementation, this would be an API call
      // For now, we'll just update the local state
      console.log("AuthProvider: Updating user profile:", userData);

      // Mock successful API call
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);

      // Update cached user data
      localStorage.setItem(`user_${user.wallet}`, JSON.stringify(updatedUser));
      localStorage.setItem(
        `user_timestamp_${user.wallet}`,
        Date.now().toString()
      );

      return true;
    } catch (err) {
      console.error("AuthProvider: Error updating user profile:", err);
      return false;
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
    const walletToRemove =
      address ||
      localStorage.getItem("wallet") ||
      sessionStorage.getItem("wallet");
    if (walletToRemove) {
      localStorage.removeItem(`user_${walletToRemove}`);
      localStorage.removeItem(`user_timestamp_${walletToRemove}`);
    }

    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");

    // Redirect to home
    router.push("/");
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for wallet in storage or connected wallet
        const storedWallet =
          localStorage.getItem("wallet") || sessionStorage.getItem("wallet");
        const walletToUse = storedWallet || (isConnected ? address : null);

        if (walletToUse) {
          await fetchUserData(walletToUse);
        }
      } catch (err) {
        console.error("AuthProvider: Error initializing auth:", err);
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
        console.log("AuthProvider: Wallet connected:", address);

        // Store wallet address
        localStorage.setItem("wallet", address);
        sessionStorage.setItem("wallet", address);

        // Fetch user data
        await fetchUserData(address);
      } else if (!isConnected && user) {
        // Wallet disconnected
        console.log("AuthProvider: Wallet disconnected");
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
      if (isProtectedRoute() && !isInitializing) {
        const walletAddress =
          address ||
          localStorage.getItem("wallet") ||
          sessionStorage.getItem("wallet");

        if (!walletAddress) {
          // Not authenticated, redirect to home
          console.log(
            "AuthProvider: Not authenticated, redirecting from protected route"
          );
          router.push("/");
        } else if (!user && !isLoading) {
          // Try to fetch user data
          await fetchUserData(walletAddress);
        }
      }
    };

    checkAuth();
  }, [pathname, user, isInitializing]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitializing,
        error,
        logout,
        refreshUser,
        updateUserProfile,
      }}
    >
      {children}
      {/* Show loader for protected routes during initialization or loading */}
      {(isInitializing || isLoading) && isProtectedRoute() && <SimpleLoader />}
    </AuthContext.Provider>
  );
}
