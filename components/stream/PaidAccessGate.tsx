"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { getStellarNetwork } from "@/lib/stellar/config";
import { buildStreamAccessPayment } from "@/lib/stream/access-payment";
import { submitTransaction } from "@/lib/stellar/payments";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { hasUsdcTrustline, getUsdcBalance } from "@/lib/stellar/usdc";
import { EnableUsdcButton } from "@/components/wallet/EnableUsdcButton";
import { AddFundsButton } from "@/components/wallet/AddFundsButton";

function parseMoneyToNumber(amount: string): number {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

export function PaidAccessGate(props: {
  streamerUsername: string;
  streamerId: string;
  streamerPublicKey: string | null;
  viewerPublicKey: string | null;
  priceUsdc: string | null;
  onVerified: () => void;
}) {
  const {
    streamerUsername,
    streamerId,
    streamerPublicKey,
    viewerPublicKey,
    priceUsdc,
    onVerified,
  } = props;

  const { kit, connect } = useStellarWallet();
  const network = useMemo(() => getStellarNetwork(), []);

  const [hasTrustline, setHasTrustline] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPay =
    !!viewerPublicKey &&
    !!streamerPublicKey &&
    !!priceUsdc &&
    hasTrustline === true;

  const refresh = async () => {
    if (!viewerPublicKey) {
      setHasTrustline(null);
      setBalance(null);
      return;
    }
    try {
      const tl = await hasUsdcTrustline({
        publicKey: viewerPublicKey,
        network,
      });
      setHasTrustline(tl);
      if (tl) {
        const b = await getUsdcBalance({ publicKey: viewerPublicKey, network });
        setBalance(b);
      } else {
        setBalance(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NEXT_PUBLIC_STELLAR_USDC_ISSUER_TESTNET")) {
        setError(
          "USDC is not configured on this environment. Set NEXT_PUBLIC_STELLAR_USDC_ISSUER_TESTNET in your env to enable USDC payments."
        );
      } else {
        setError(msg || "Failed to load USDC status");
      }
      setHasTrustline(null);
      setBalance(null);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerPublicKey, network]);

  const insufficient =
    hasTrustline === true &&
    !!balance &&
    !!priceUsdc &&
    parseMoneyToNumber(balance) < parseMoneyToNumber(priceUsdc);

  const handlePay = async () => {
    if (!viewerPublicKey || !streamerPublicKey || !priceUsdc) {
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      const tx = await buildStreamAccessPayment({
        viewerPublicKey,
        streamerPublicKey,
        priceUsdc,
        streamId: streamerId,
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
        network === "mainnet"
          ? "Public Global Stellar Network ; September 2015"
          : "Test SDF Network ; September 2015"
      );

      const submit = await submitTransaction(signed as any, network);
      if (!submit.success || !submit.hash) {
        throw new Error(submit.error ?? "Payment submission failed");
      }

      const verify = await fetch("/api/streams/access/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamer_username: streamerUsername,
          viewer_public_key: viewerPublicKey,
          tx_hash: submit.hash,
        }),
      });
      if (!verify.ok) {
        const data = await verify.json().catch(() => ({}));
        throw new Error(data?.error ?? "Payment verification failed");
      }

      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setIsWorking(false);
      void refresh();
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-3 bg-card border border-border rounded-lg p-6">
        <Ticket className="w-12 h-12 text-highlight mx-auto mb-2" />
        <h2 className="text-xl font-semibold text-foreground">
          {priceUsdc ? `Watch for $${priceUsdc} USDC` : "Paid stream"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Pay once and watch this stream and its recording forever.
        </p>

        {!viewerPublicKey && (
          <Button
            onClick={() => void connect()}
            disabled={isWorking}
            className="w-full"
          >
            Connect wallet
          </Button>
        )}

        {!!viewerPublicKey && hasTrustline === false && (
          <div className="space-y-2 pt-2">
            <EnableUsdcButton
              walletAddress={viewerPublicKey}
              onSuccess={() => void refresh()}
              className="w-full"
            />
          </div>
        )}

        {!!viewerPublicKey && hasTrustline === true && (
          <div className="space-y-2 pt-2">
            <Button
              onClick={() => void handlePay()}
              disabled={!canPay || isWorking || insufficient}
              className="w-full"
            >
              {isWorking
                ? "Processing…"
                : priceUsdc
                  ? `Pay $${priceUsdc} USDC`
                  : "Pay USDC"}
            </Button>

            {insufficient && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Insufficient USDC balance.
                </p>
                <AddFundsButton
                  walletAddress={viewerPublicKey}
                  paramOverrides={{ cryptoCurrencyCode: "USDC" }}
                  className="w-full"
                >
                  Buy USDC
                </AddFundsButton>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 pt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
