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

const network =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "pubnet"
    ? WalletNetwork.PUBLIC
    : WalletNetwork.TESTNET;

interface StellarWalletContextType {
  kit: StellarWalletsKit;
  address: string | null;
  publicKey: string | null;
  isConnected: boolean;
  status: "connected" | "disconnected" | "connecting";
  connect: () => Promise<void>;
  disconnect: () => void;
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  network: WalletNetwork;
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

  const [kit] = useState(() => {
    if (typeof window === "undefined") {
      return null as unknown as StellarWalletsKit;
    }
    return new StellarWalletsKit({
      selectedWalletId: FREIGHTER_ID,
      network,
      modules: allowAllModules(),
    });
  });

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

  const disconnect = useCallback(() => {
    setPublicKey(null);
    localStorage.removeItem("stellar_last_wallet");
    localStorage.removeItem("stellar_auto_connect");
  }, []);

  // Attempt wallet restoration once for returning users.
  useEffect(() => {
    if (hasAttemptedAutoConnect.current || publicKey) {
      return;
    }

    hasAttemptedAutoConnect.current = true;
    const autoConnect = localStorage.getItem("stellar_auto_connect") === "true";
    const lastWalletId = localStorage.getItem("stellar_last_wallet");

    if (!autoConnect || !lastWalletId) {
      return;
    }

    let cancelled = false;

    const restoreConnection = async () => {
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

    return () => {
      cancelled = true;
    };
  }, [kit, publicKey]);

  return (
    <StellarWalletContext.Provider
      value={{
        kit,
        address: publicKey,
        publicKey,
        isConnected,
        status,
        connect,
        disconnect,
        isLoading: isConnecting,
        isConnecting,
        error,
        network,
      }}
    >
      {children}
    </StellarWalletContext.Provider>
  );
}
