"use client";

import { useEffect, useMemo, useState } from "react";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { Gift, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AddFundsButton } from "@/components/wallet/AddFundsButton";
import { EnableUsdcButton } from "@/components/wallet/EnableUsdcButton";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { getNetworkPassphrase, getStellarNetwork } from "@/lib/stellar/config";
import {
  buildGiftTransaction,
  submitTransaction,
} from "@/lib/stellar/payments";
import { getUsdcBalance, hasUsdcTrustline } from "@/lib/stellar/usdc";
import type { SendGiftMessagePayload } from "@/types/chat";

interface GiftDefinition {
  id: number;
  name: string;
  emoji: string;
  usd_value: string;
  sort_order: number;
  animation: string;
  active: boolean;
}

interface GiftPickerProps {
  isOpen: boolean;
  onClose: () => void;
  playbackId: string;
  viewerPublicKey: string;
  streamerPublicKey: string;
  streamerUsername: string;
  onSendGiftMessage: (payload: SendGiftMessagePayload) => Promise<void>;
}

function trustlineSessionKey(publicKey: string) {
  return `streamfi-usdc-gifts-enabled:${publicKey}`;
}

export function GiftPicker({
  isOpen,
  onClose,
  playbackId,
  viewerPublicKey,
  streamerPublicKey,
  streamerUsername,
  onSendGiftMessage,
}: GiftPickerProps) {
  const { kit, privyWallet } = useStellarWallet();
  const [gifts, setGifts] = useState<GiftDefinition[]>([]);
  const [selectedGift, setSelectedGift] = useState<GiftDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingTrustline, setIsCheckingTrustline] = useState(false);
  const [showTrustlineDialog, setShowTrustlineDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTrustline, setHasTrustline] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<string>("0");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;
    fetch("/api/gifts")
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load gifts");
        }
        const data = await response.json();
        if (active) {
          setGifts(data.gifts ?? []);
        }
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load gifts");
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !viewerPublicKey) {
      return;
    }

    const network = getStellarNetwork();
    const cached =
      typeof window !== "undefined"
        ? sessionStorage.getItem(trustlineSessionKey(viewerPublicKey))
        : null;
    if (cached === "true") {
      setHasTrustline(true);
      getUsdcBalance({ publicKey: viewerPublicKey, network })
        .then(setBalance)
        .catch(() => setBalance("0"));
      return;
    }

    let active = true;
    setIsCheckingTrustline(true);
    hasUsdcTrustline({ publicKey: viewerPublicKey, network })
      .then(async trustline => {
        if (!active) {
          return;
        }
        setHasTrustline(trustline);
        if (trustline) {
          sessionStorage.setItem(trustlineSessionKey(viewerPublicKey), "true");
          const usdcBalance = await getUsdcBalance({
            publicKey: viewerPublicKey,
            network,
          });
          if (active) {
            setBalance(usdcBalance);
          }
        } else {
          setShowTrustlineDialog(true);
        }
      })
      .catch(err => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to check USDC trustline"
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsCheckingTrustline(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, viewerPublicKey]);

  const insufficientBalance = useMemo(() => {
    if (!selectedGift) {
      return false;
    }
    return (
      Number.parseFloat(balance || "0") <
      Number.parseFloat(selectedGift.usd_value)
    );
  }, [balance, selectedGift]);

  const refreshUsdcState = async () => {
    const network = getStellarNetwork();
    setHasTrustline(true);
    sessionStorage.setItem(trustlineSessionKey(viewerPublicKey), "true");
    const usdcBalance = await getUsdcBalance({
      publicKey: viewerPublicKey,
      network,
    });
    setBalance(usdcBalance);
    setShowTrustlineDialog(false);
  };

  const handleConfirmGift = async () => {
    if (!selectedGift) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const network = getStellarNetwork();
      const transaction = await buildGiftTransaction({
        sourcePublicKey: viewerPublicKey,
        destinationPublicKey: streamerPublicKey,
        usdcAmount: selectedGift.usd_value,
        network,
      });

      const walletNetwork =
        network === "mainnet" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;
      const { signedTxXdr } = await kit.signTransaction(transaction.toXDR(), {
        networkPassphrase: walletNetwork,
        address: viewerPublicKey,
      });
      const signedTransaction = TransactionBuilder.fromXDR(
        signedTxXdr,
        getNetworkPassphrase(network)
      );

      const result = await submitTransaction(signedTransaction as any, network);
      if (!result.success || !result.hash) {
        throw new Error(result.error ?? "Gift transaction failed");
      }

      await onSendGiftMessage({
        wallet: viewerPublicKey,
        playbackId,
        content: `${selectedGift.emoji} sent a ${selectedGift.name}`,
        metadata: {
          gift_name: selectedGift.name,
          gift_emoji: selectedGift.emoji,
          usd_value: selectedGift.usd_value,
          tx_hash: result.hash,
          animation: selectedGift.animation,
        },
      });

      const usdcBalance = await getUsdcBalance({
        publicKey: viewerPublicKey,
        network,
      });
      setBalance(usdcBalance);
      setSelectedGift(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send gift");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Send a gift</DialogTitle>
            <DialogDescription>
              Send Flower, Candy, Crown, Lion, or Dragon to @{streamerUsername}{" "}
              with USDC on Stellar.
            </DialogDescription>
          </DialogHeader>

          {isCheckingTrustline ? (
            <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking USDC gift access…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gifts.map(gift => (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => setSelectedGift(gift)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      selectedGift?.id === gift.id
                        ? "border-highlight bg-highlight/10"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <div className="text-3xl">{gift.emoji}</div>
                    <div className="mt-3 font-semibold text-foreground">
                      {gift.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${gift.usd_value} USDC
                    </div>
                  </button>
                ))}
              </div>

              {selectedGift && (
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-background px-3 py-2 text-3xl shadow-sm">
                      {selectedGift.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">
                        Send {selectedGift.emoji} {selectedGift.name} to @
                        {streamerUsername} for ${selectedGift.usd_value} USDC?
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Your current USDC balance: ${balance}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {insufficientBalance && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-highlight/20 bg-highlight/10 p-3">
                  <p className="text-sm text-muted-foreground">
                    Insufficient USDC balance for this gift.
                  </p>
                  <AddFundsButton
                    walletAddress={viewerPublicKey}
                    isPrivyUser={!!privyWallet}
                    paramOverrides={{ cryptoCurrencyCode: "USDC" }}
                  >
                    Buy USDC
                  </AddFundsButton>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
                  {error}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmGift}
              disabled={
                isLoading ||
                !selectedGift ||
                isCheckingTrustline ||
                hasTrustline !== true ||
                insufficientBalance
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending
                </>
              ) : (
                <>
                  <Gift className="mr-2 h-4 w-4" />
                  Send Gift
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTrustlineDialog} onOpenChange={setShowTrustlineDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Enable USDC Gifts</DialogTitle>
            <DialogDescription>
              Your wallet needs a one-time USDC trustline before it can send or
              receive gifts on Stellar. This reserves 0.5 XLM on-chain.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            After this one-time setup, gifts will open normally on future
            visits.
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTrustlineDialog(false)}
            >
              Not now
            </Button>
            <EnableUsdcButton
              walletAddress={viewerPublicKey}
              onSuccess={refreshUsdcState}
              className="bg-highlight text-background hover:bg-highlight/90"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
