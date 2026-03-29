"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import {
  buildTipTransaction,
  submitTransaction,
  hasInsufficientBalance,
  getCurrentNetwork,
} from "@/lib/stellar/payments";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { AddFundsButton } from "@/components/wallet/AddFundsButton";

const PRESETS = ["1", "5", "10"] as const;

export function QuickTipBar(props: {
  playbackId: string;
  streamerUsername: string;
  streamerPublicKey: string;
  viewerPublicKey: string;
  hidden?: boolean;
  onCustomTip?: () => void;
}) {
  const {
    playbackId,
    streamerPublicKey,
    viewerPublicKey,
    hidden = false,
    onCustomTip,
  } = props;

  const { kit } = useStellarWallet();
  const [isPaying, setIsPaying] = useState(false);
  const [insufficient, setInsufficient] = useState(false);

  const network = useMemo(() => getCurrentNetwork(), []);

  if (hidden) {
    return null;
  }

  const postTipSystemMessage = async (amount: string) => {
    const uname =
      typeof window !== "undefined"
        ? sessionStorage.getItem("username") || "Someone"
        : "Someone";
    const content = `💜 @${uname} tipped ${amount} XLM`;
    await fetch("/api/streams/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: viewerPublicKey,
        playbackId,
        content,
        messageType: "system",
      }),
    });
  };

  const sendPreset = async (amount: string) => {
    setIsPaying(true);
    setInsufficient(false);
    try {
      const noBalance = await hasInsufficientBalance(viewerPublicKey, amount);
      if (noBalance) {
        setInsufficient(true);
        return;
      }

      const tx = await buildTipTransaction({
        sourcePublicKey: viewerPublicKey,
        destinationPublicKey: streamerPublicKey,
        amount,
        network,
      });

      const walletNetwork =
        network === "mainnet" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;
      const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), {
        networkPassphrase: walletNetwork,
        address: viewerPublicKey,
      });
      const signed = TransactionBuilder.fromXDR(
        signedTxXdr,
        network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
      );

      const result = await submitTransaction(signed as any, network);
      if (!result.success) {
        throw new Error(result.error ?? "Tip transaction failed");
      }

      await postTipSystemMessage(amount);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2 pb-2 flex-wrap">
      {PRESETS.map(preset => (
        <Button
          key={preset}
          size="sm"
          variant="outline"
          disabled={isPaying}
          onClick={() => void sendPreset(preset)}
        >
          {preset} XLM
        </Button>
      ))}
      <Button
        size="sm"
        variant="outline"
        disabled={isPaying}
        onClick={onCustomTip}
      >
        Custom…
      </Button>

      {insufficient && (
        <div className="ml-auto">
          <AddFundsButton walletAddress={viewerPublicKey}>
            Add XLM
          </AddFundsButton>
        </div>
      )}
    </div>
  );
}
