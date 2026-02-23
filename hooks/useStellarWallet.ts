import { useState, useEffect } from "react";
import { getStellarWalletsKit } from "@/lib/stellar/payments";

/**
 * Hook to manage Stellar wallet connection state
 * Automatically fetches the connected wallet's public key on mount
 * and listens for wallet disconnection events
 */
export function useStellarWallet() {
  const [stellarPublicKey, setStellarPublicKey] = useState<string>("");

  useEffect(() => {
    const getStellarWallet = async () => {
      try {
        const kit = getStellarWalletsKit();
        const publicKey = await kit.getPublicKey();
        setStellarPublicKey(publicKey);
      } catch {
        setStellarPublicKey("");
      }
    };

    getStellarWallet();
  }, []);

  // Listen for wallet disconnection events
  useEffect(() => {
    const kit = getStellarWalletsKit();

    const handleDisconnect = () => {
      setStellarPublicKey("");
    };

    // Note: Event listener support depends on wallet kit implementation
    // This is a placeholder for when the feature becomes available
    if (typeof kit.on === "function") {
      kit.on("walletDisconnected", handleDisconnect);

      return () => {
        if (typeof kit.off === "function") {
          kit.off("walletDisconnected", handleDisconnect);
        }
      };
    }
  }, []);

  return stellarPublicKey;
}
