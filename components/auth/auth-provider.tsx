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


type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  logout: () => void;
  refreshUser: (walletAddress?: string) => Promise<User | null>;
  updateUserProfile: (userData: Partial<User>) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isInitializing: true,
  error: null,
  logout: () => {},
  refreshUser: async () => null,
  updateUserProfile: async () => false,
});


export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

 
  const router = useRouter();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const isSessionValid = (timestamp: number) => {
    return Date.now() - timestamp < SESSION_TIMEOUT;
  };


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
    document.cookie = "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
  };


  const fetchUserData = async (walletAddress?: string): Promise<User | null> => {
    if (!walletAddress) {
      walletAddress = address || localStorage.getItem("wallet") || sessionStorage.getItem("wallet") || undefined;
      if (!walletAddress) return null;
    }

    try {
      setError(null);
      setIsLoading(true);

 
      const cachedUserData = localStorage.getItem(`user_${walletAddress}`);
      const cachedTimestamp = localStorage.getItem(`user_timestamp_${walletAddress}`);


      if (cachedUserData && cachedTimestamp) {
        const parsedUser = JSON.parse(cachedUserData);
        const timestamp = parseInt(cachedTimestamp);
        
        if (isSessionValid(timestamp)) {
          setUser(parsedUser);
          setSessionCookies(walletAddress);
          return parsedUser;
        } else {
   
          localStorage.removeItem(`user_${walletAddress}`);
          localStorage.removeItem(`user_timestamp_${walletAddress}`);
          clearSessionCookies();
        }
      }

      const response = await fetch(`/api/users/${walletAddress}`, {
        headers: {
          'x-wallet-address': walletAddress
        }
      });

      if (response.ok) {
        const data = await response.json();

   
        localStorage.setItem(`user_${walletAddress}`, JSON.stringify(data.user));
        localStorage.setItem(`user_timestamp_${walletAddress}`, Date.now().toString());


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


  const logout = () => {

    disconnect();

 
    setUser(null);


    const walletToRemove = address || localStorage.getItem("wallet") || sessionStorage.getItem("wallet");
    if (walletToRemove) {
      localStorage.removeItem(`user_${walletToRemove}`);
      localStorage.removeItem(`user_timestamp_${walletToRemove}`);
    }

    localStorage.removeItem("wallet");
    sessionStorage.removeItem("wallet");
    
   
    clearSessionCookies();

  
    router.push("/");
  };

  useEffect(() => {
    const handleWalletChange = async () => {

      
      if (isConnected && address) {
      
        setSessionCookies(address);
     
        try {
          await fetchUserData(address);
      
        } catch (error) {
          console.error("[AuthProvider] Error fetching user data:", error);
        }
      } else {
     
        setUser(null);
        clearSessionCookies();
      }
    };

    handleWalletChange();
  }, [isConnected, address]);


  useEffect(() => {
    const initAuth = async () => {
      try {
     
        const storedWallet = localStorage.getItem("wallet") || sessionStorage.getItem("wallet");
        const walletToUse = storedWallet || (isConnected ? address : null);

        if (walletToUse) {
       
          setSessionCookies(walletToUse);
          await fetchUserData(walletToUse);
        } else {
    
        }
      } catch (err) {
       
        setError("Failed to initialize authentication");
      }
    };

    initAuth();
  }, []);

  // Refresh session
  const refreshSession = useCallback(() => {
    const storedWallet = localStorage.getItem("wallet");
    const sessionWallet = sessionStorage.getItem("wallet");
    const walletAddress = address || (storedWallet ? storedWallet : undefined) || (sessionWallet ? sessionWallet : undefined);
    if (walletAddress) {
      setSessionCookies(walletAddress);
    }
  }, [address]);

  useEffect(() => {
    if (user) {
      const interval = setInterval(refreshSession, SESSION_REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [user, refreshSession]);

  useEffect(() => {
    const handleUserActivity = () => {
      if (user) {
        refreshSession();
      }
    };


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
      {isInitializing && <SimpleLoader />}
    </AuthContext.Provider>
  );
}
