"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
  xBULL_ID,
  ALBEDO_ID,
  LOBSTR_ID,
  HANA_ID,
} from "@creit.tech/stellar-wallets-kit";

interface StellarWalletContextType {
  kit: StellarWalletsKit | null;
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: (walletId: string) => Promise<void>;
  disconnectWallet: () => void;
}

const StellarWalletContext = createContext<
  StellarWalletContextType | undefined
>(undefined);

export function StellarWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Stellar Wallets Kit
  useEffect(() => {
    const stellarKit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET, // Change to MAINNET for production
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });

    setKit(stellarKit);
  }, []);

  const connectWallet = async (walletId: string) => {
    if (!kit) {
      setError("Wallet kit not initialized");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Set the selected wallet
      kit.setWallet(walletId);

      // Get the public key (this triggers the wallet connection)
      const { address } = await kit.getAddress();

      setPublicKey(address);
      setIsConnected(true);
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setError(
        err instanceof Error ? err.message : "Failed to connect wallet"
      );
      setIsConnected(false);
      setPublicKey(null);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setPublicKey(null);
    setIsConnected(false);
    setError(null);
  };

  return (
    <StellarWalletContext.Provider
      value={{
        kit,
        publicKey,
        isConnected,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </StellarWalletContext.Provider>
  );
}

export function useStellarWallet() {
  const context = useContext(StellarWalletContext);
  if (context === undefined) {
    throw new Error(
      "useStellarWallet must be used within a StellarWalletProvider"
    );
  }
  return context;
}
