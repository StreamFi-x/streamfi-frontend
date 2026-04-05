"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { buildUsdcTrustlineTransaction } from "@/lib/stellar/usdc";
import { submitTransaction } from "@/lib/stellar/payments";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { getNetworkPassphrase, getStellarNetwork } from "@/lib/stellar/config";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";

export function EnableUsdcButton(props: {
  walletAddress: string;
  onSuccess?: () => void;
  className?: string;
}) {
  const { walletAddress, onSuccess, className } = props;
  const { kit } = useStellarWallet();
  const [isWorking, setIsWorking] = useState(false);

  const handleEnable = async () => {
    setIsWorking(true);
    try {
      const network = getStellarNetwork();
      const tx = await buildUsdcTrustlineTransaction({
        publicKey: walletAddress,
        network,
      });

      const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), {
        networkPassphrase:
          network === "mainnet" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
        address: walletAddress,
      });

      const signed = TransactionBuilder.fromXDR(
        signedTxXdr,
        getNetworkPassphrase(network)
      );

      const result = await submitTransaction(signed as any, network);
      if (!result.success) {
        throw new Error(
          result.error ?? "Failed to submit trustline transaction"
        );
      }
      onSuccess?.();
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Button
      onClick={handleEnable}
      disabled={isWorking}
      className={className}
      variant="outline"
    >
      {isWorking ? "Enabling USDC…" : "Enable USDC"}
    </Button>
  );
}
