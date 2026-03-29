"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";
import { AddFundsButton } from "@/components/wallet/AddFundsButton";
import {
  buildTipTransaction,
  submitTransaction,
  hasInsufficientBalance,
  getXLMPrice,
  calculateFeeEstimate,
} from "@/lib/stellar/payments";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientUsername: string;
  recipientPublicKey: string;
  recipientAvatar?: string;
  senderPublicKey: string;
  isPrivyUser?: boolean;
  onSuccess?: (txHash: string, amount: string) => void;
  onError?: (error: string) => void;
}

type TransactionState =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "error";

const PRESET_AMOUNTS = [1, 5, 10, 25];
const MAX_TIP_AMOUNT = 10000;
const MIN_TIP_AMOUNT = 0.0000001;

export function TipModal({
  isOpen,
  onClose,
  recipientUsername,
  recipientPublicKey,
  recipientAvatar,
  senderPublicKey,
  isPrivyUser = false,
  onSuccess,
  onError,
}: TipModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [transactionState, setTransactionState] =
    useState<TransactionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [xlmPrice, setXlmPrice] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [priceFetchFailed, setPriceFetchFailed] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);

  const { kit } = useStellarWallet();
  const fee = calculateFeeEstimate();
  const usdEquivalent =
    xlmPrice && amount ? (parseFloat(amount) * xlmPrice).toFixed(2) : "0.00";

  useEffect(() => {
    if (isOpen) {
      setIsLoadingPrice(true);
      setPriceFetchFailed(false);
      getXLMPrice()
        .then((price: number) => {
          setXlmPrice(price);
          setPriceFetchFailed(false);
        })
        .catch((err: unknown) => {
          console.error("Failed to fetch XLM price:", err);
          setPriceFetchFailed(true);
        })
        .finally(() => setIsLoadingPrice(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const resetModal = () => {
    setAmount("");
    setTransactionState("idle");
    setError(null);
    setIsInsufficientBalance(false);
  };

  const handlePresetClick = (presetAmount: number) => {
    setAmount(presetAmount.toString());
    setError(null);
    setIsInsufficientBalance(false);
  };

  const handleAmountChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
      setIsInsufficientBalance(false);
    }
  };

  const isValidStellarPublicKey = (key: string): boolean => {
    return key.startsWith("G") && key.length === 56;
  };

  const validateAmount = (): boolean => {
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return false;
    }

    if (parsedAmount < MIN_TIP_AMOUNT) {
      setError(`Amount is too small. Minimum is ${MIN_TIP_AMOUNT} XLM`);
      return false;
    }

    if (parsedAmount > MAX_TIP_AMOUNT) {
      setError(
        `Amount is too large. Maximum is ${MAX_TIP_AMOUNT.toLocaleString()} XLM`
      );
      return false;
    }

    if (!isValidStellarPublicKey(recipientPublicKey)) {
      setError("Invalid recipient Stellar address");
      return false;
    }

    if (!isValidStellarPublicKey(senderPublicKey)) {
      setError("Invalid sender Stellar address");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateAmount()) {
      return;
    }

    setError(null);
    setIsInsufficientBalance(false);

    try {
      setTransactionState("building");
      const insufficientBalance = await hasInsufficientBalance(
        senderPublicKey,
        amount
      );

      if (insufficientBalance) {
        setError(
          "Insufficient balance. Please ensure you have enough XLM to cover the tip and transaction fee."
        );
        setIsInsufficientBalance(true);
        setTransactionState("error");
        return;
      }

      const network =
        process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
          ? "mainnet"
          : "testnet";
      const transaction = await buildTipTransaction({
        sourcePublicKey: senderPublicKey,
        destinationPublicKey: recipientPublicKey,
        amount: amount,
        network: network as "testnet" | "mainnet",
      });

      setTransactionState("signing");
      const walletNetwork =
        network === "mainnet" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;
      const { signedTxXdr } = await kit.signTransaction(transaction.toXDR(), {
        networkPassphrase: walletNetwork,
        address: senderPublicKey,
      });
      const networkPassphrase =
        network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
      const signedTransaction = TransactionBuilder.fromXDR(
        signedTxXdr,
        networkPassphrase
      );

      setTransactionState("submitting");
      const result = await submitTransaction(
        signedTransaction as any,
        network as "testnet" | "mainnet"
      );

      if (result.success) {
        if (onSuccess && result.hash) {
          onSuccess(result.hash, amount);
        }
        return;
      }
      throw result.error
        ? new Error(result.error)
        : new Error("Transaction failed");
    } catch (err: unknown) {
      console.error("Transaction error:", err);

      let errorMessage = "An unexpected error occurred. Please try again.";

      if (err instanceof Error) {
        if (
          err.message.includes("User declined") ||
          err.message.includes("rejected")
        ) {
          errorMessage = "Transaction was cancelled. Please try again.";
        } else if (
          err.message.includes("insufficient") ||
          err.message.includes("balance")
        ) {
          errorMessage =
            "Insufficient balance. Your balance may have changed. Please try a smaller amount.";
          setIsInsufficientBalance(true);
        } else if (err.message.includes("timeout")) {
          errorMessage = "Transaction timed out. Please try again.";
        } else if (
          err.message.includes("network") ||
          err.message.includes("connectivity")
        ) {
          errorMessage =
            "Network connection issue. Please check your connection and try again.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setTransactionState("error");
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const handleClose = () => {
    if (transactionState === "signing" || transactionState === "submitting") {
      return;
    }
    onClose();
  };

  const getStateMessage = () => {
    switch (transactionState) {
      case "building":
        return "Building transaction...";
      case "signing":
        return "Please approve the transaction in your wallet";
      case "submitting":
        return "Submitting transaction to network...";
      case "error":
        return "Transaction failed";
      default:
        return "";
    }
  };

  const isProcessing =
    transactionState === "building" ||
    transactionState === "signing" ||
    transactionState === "submitting";

  const canSubmit = amount !== "" && transactionState === "idle";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Tip</DialogTitle>
          <DialogDescription>
            Send a tip to @{recipientUsername}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={recipientAvatar} alt={recipientUsername} />
              <AvatarFallback>
                {recipientUsername.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold">@{recipientUsername}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                {recipientPublicKey}
              </p>
            </div>
          </div>

          {priceFetchFailed && !isLoadingPrice && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                Unable to load current XLM price. USD conversion unavailable.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Select Amount</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map(presetAmount => (
                <Button
                  key={presetAmount}
                  variant={
                    amount === presetAmount.toString() ? "default" : "outline"
                  }
                  onClick={() => handlePresetClick(presetAmount)}
                  disabled={isProcessing}
                  className="font-semibold"
                >
                  {presetAmount} XLM
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-amount">Or Enter Custom Amount</Label>
            <div className="relative">
              <Input
                id="custom-amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                disabled={isProcessing}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                XLM
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum: {MAX_TIP_AMOUNT.toLocaleString()} XLM
            </p>
          </div>

          {amount !== "" && parseFloat(amount) > 0 && (
            <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-semibold">{amount} XLM</span>
              </div>
              {xlmPrice > 0 && !isLoadingPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">USD Value:</span>
                  <span className="font-semibold">≈ ${usdEquivalent}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network Fee:</span>
                <span className="font-semibold">{fee.toFixed(7)} XLM</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span>Total:</span>
                <span>{(parseFloat(amount) + fee).toFixed(7)} XLM</span>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <p className="text-sm text-blue-500">{getStateMessage()}</p>
            </div>
          )}

          {error && transactionState === "error" && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            </div>
          )}

          {isInsufficientBalance && transactionState === "error" && (
            <div className="flex items-center justify-between gap-3 p-3 bg-highlight/10 border border-highlight/20 rounded-lg">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Need more XLM? Top up your wallet with fiat.
              </p>
              <AddFundsButton
                walletAddress={senderPublicKey}
                isPrivyUser={isPrivyUser}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Send Tip"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
