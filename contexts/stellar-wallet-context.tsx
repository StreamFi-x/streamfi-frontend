"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";

interface StellarWalletContextType {
  address: string | null;
  publicKey: string | null;
  isConnected: boolean;
  status: "connected" | "disconnected" | "connecting";
  connect: () => Promise<void>;
  connectWallet: (walletId: string) => Promise<void>;
  disconnect: () => void;
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  kit: StellarWalletsKit;
}

const StellarWalletContext = createContext<
  StellarWalletContextType | undefined
>(undefined);

export const useStellarWallet = () => {
  const context = useContext(StellarWalletContext);
  if (!context) {
    throw new Error(
      "useStellarWallet must be used within a StellarWalletProvider"
    );
  }
  return context;
};

export function StellarWalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedAutoConnect = useRef(false);

  const [kit] = useState(
    () =>
      new StellarWalletsKit({
        selectedWalletId: FREIGHTER_ID,
        network: WalletNetwork.TESTNET,
        modules: allowAllModules(),
      })
  );

  const isConnected = !!publicKey;
  const status = isConnecting
    ? "connecting"
    : isConnected
      ? "connected"
      : "disconnected";

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await kit.openModal({
        onWalletSelected: async wallet => {
          kit.setWallet(wallet.id);
          const { address } = await kit.getAddress();
          setPublicKey(address);
          localStorage.setItem("stellar_last_wallet", wallet.id);
          localStorage.setItem("stellar_auto_connect", "true");
          setIsConnecting(false);
        },
        onClosed: err => {
          console.log("Modal closed", err);
          setIsConnecting(false);
        },
      });
    } catch (err) {
      console.error("Failed to connect Stellar wallet:", err);
      setError("Failed to connect wallet");
      setIsConnecting(false);
    }
  }, [kit]);

  const connectWallet = useCallback(async (walletId: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      // Set the wallet first - this initializes the wallet module
      kit.setWallet(walletId);
      
      // Small delay to ensure wallet is properly initialized
      // This is especially important for extension wallets
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // For some wallets (like Albedo), getAddress might open a modal
      // For extension wallets, it should work directly
      const result = await kit.getAddress();
      
      if (result && result.address) {
        setPublicKey(result.address);
        localStorage.setItem("stellar_last_wallet", walletId);
        localStorage.setItem("stellar_auto_connect", "true");
      } else {
        throw new Error("No address returned from wallet");
      }
    } catch (err: any) {
      console.error("Failed to connect Stellar wallet:", err);
      console.error("Error details:", {
        walletId,
        error: err,
        message: err?.message,
        stack: err?.stack,
      });
      
      const errorMessage = err?.message || err?.toString() || String(err) || "Failed to connect wallet";
      
      // Check if wallet is not installed
      if (errorMessage.includes("not installed") || 
          errorMessage.includes("not found") ||
          errorMessage.includes("extension") ||
          errorMessage.includes("Extension not found") ||
          errorMessage.includes("Wallet not found") ||
          errorMessage.toLowerCase().includes("no provider") ||
          errorMessage.toLowerCase().includes("not available") ||
          errorMessage.toLowerCase().includes("unavailable")) {
        setError(`${walletId.charAt(0).toUpperCase() + walletId.slice(1)} wallet is not installed. Please install the extension first.`);
      } else if (errorMessage.includes("rejected") || 
                 errorMessage.includes("denied") ||
                 errorMessage.includes("User rejected") ||
                 errorMessage.includes("cancelled") ||
                 errorMessage.includes("canceled") ||
                 errorMessage.includes("User cancelled") ||
                 errorMessage.includes("user cancelled")) {
        setError("Connection was rejected. Please try again.");
      } else if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        setError("Connection timed out. Please try again.");
      } else {
        // Show a more user-friendly error message
        setError(`Failed to connect ${walletId}. ${errorMessage}`);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [kit]);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    localStorage.removeItem("stellar_last_wallet");
    localStorage.removeItem("stellar_auto_connect");
  }, []);

  // Attempt wallet restoration once for returning users (delayed so it doesn't
  // open the wallet popup immediately on reload and block the Connect Wallet modal).
  useEffect(() => {
    if (hasAttemptedAutoConnect.current || publicKey) {
      return;
    }

    const autoConnect = localStorage.getItem("stellar_auto_connect") === "true";
    const lastWalletId = localStorage.getItem("stellar_last_wallet");

    if (!autoConnect || !lastWalletId) {
      return;
    }

    hasAttemptedAutoConnect.current = true;
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      const restoreConnection = async () => {
        if (cancelled) return;
        setIsConnecting(true);
        setError(null);
        try {
          kit.setWallet(lastWalletId);
          const { address } = await kit.getAddress();
          if (!cancelled && address) {
            setPublicKey(address);
            localStorage.setItem("stellar_last_wallet", lastWalletId);
            localStorage.setItem("stellar_auto_connect", "true");
          }
        } catch (err) {
          if (!cancelled) {
            console.warn("Stellar auto-connect failed:", err);
          }
        } finally {
          if (!cancelled) {
            setIsConnecting(false);
          }
        }
      };

      void restoreConnection();
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [kit, publicKey]);

  return (
    <StellarWalletContext.Provider
      value={{
        address: publicKey,
        publicKey,
        isConnected,
        status,
        connect,
        connectWallet,
        disconnect,
        isLoading: isConnecting,
        isConnecting,
        error,
        kit,
      }}
    >
      {children}
    </StellarWalletContext.Provider>
  );
}
