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
import { Loader2, CheckCircle2, XCircle, ArrowRight, AlertTriangle } from "lucide-react";
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
import { TipConfirmation } from "./TipConfirmation";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientUsername: string;
  recipientPublicKey: string;
  recipientAvatar?: string;
  senderPublicKey: string;
  onSuccess?: (txHash: string, amount: string) => void;
  onError?: (error: string) => void;
}

type TransactionState =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "success"
  | "error";

const PRESET_AMOUNTS = [1, 5, 10, 25];
const MAX_TIP_AMOUNT = 10000; // 10,000 XLM cap
const MIN_TIP_AMOUNT = 0.0000001;

export function TipModal({
  isOpen,
  onClose,
  recipientUsername,
  recipientPublicKey,
  recipientAvatar,
  senderPublicKey,
  onSuccess,
  onError,
}: TipModalProps) {
  // Fix #3 - Single state for amount (no more DRY violation)
  const [amount, setAmount] = useState<string>("");
  const [transactionState, setTransactionState] =
    useState<TransactionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [xlmPrice, setXlmPrice] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  // Fix #5 - Track price fetch failures
  const [priceFetchFailed, setPriceFetchFailed] = useState<boolean>(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [structuredError, setStructuredError] = useState<{
    message: string;
    details?: string;
    code?: string;
  } | null>(null);

  const { kit } = useStellarWallet();
  const fee = calculateFeeEstimate();
  const usdEquivalent = xlmPrice && amount
    ? (parseFloat(amount) * xlmPrice).toFixed(2)
    : "0.00";

  // Fix #5 - Fetch XLM price with failure tracking
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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const resetModal = () => {
    setAmount("");
    setTransactionState("idle");
    setError(null);
    setTxHash(null);
    setIsConfirmationOpen(false);
    setStructuredError(null);
  };

  const handlePresetClick = (presetAmount: number) => {
    setAmount(presetAmount.toString());
    setError(null);
  };

  const handleAmountChange = (value: string) => {
    // Only allow valid decimal numbers
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  // Fix #4 - Validate Stellar public key format
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

    // Fix #4 - Max amount validation
    if (parsedAmount > MAX_TIP_AMOUNT) {
      setError(`Amount is too large. Maximum is ${MAX_TIP_AMOUNT.toLocaleString()} XLM`);
      return false;
    }

    // Fix #4 - Validate Stellar public keys
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
    // Validate amount
    if (!validateAmount()) {
      return;
    }

    setError(null);

    try {
      // Check for sufficient balance
      setTransactionState("building");
      const insufficientBalance = await hasInsufficientBalance(
        senderPublicKey,
        amount
      );

      if (insufficientBalance) {
        setError(
          "Insufficient balance. Please ensure you have enough XLM to cover the tip and transaction fee."
        );
        setTransactionState("error");
        if (onError) {
          onError("Insufficient balance");
        }
        return;
      }

      // Build transaction
      const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
      const transaction = await buildTipTransaction({
        sourcePublicKey: senderPublicKey,
        destinationPublicKey: recipientPublicKey,
        amount: amount,
        network: network as "testnet" | "mainnet",
      });

      // Sign transaction with connected wallet
      setTransactionState("signing");
      const walletNetwork = network === "mainnet" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;
      const { signedTxXdr } = await kit.signTransaction(transaction.toXDR(), {
        networkPassphrase: walletNetwork,
        address: senderPublicKey,
      });
      const networkPassphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
      const signedTransaction = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);

      // Submit signed transaction
      setTransactionState("submitting");
      const result = await submitTransaction(signedTransaction as any, network as "testnet" | "mainnet");

      if (result.success) {
        setTransactionState("success");
        setTxHash(result.hash ?? null);
        setIsConfirmationOpen(true);
        // Call onSuccess callback if provided
        if (onSuccess && result.hash) {
          onSuccess(result.hash, amount);
        }
      } else {
        throw result.error ? new Error(result.error) : new Error("Transaction failed");
      }
    } catch (err: unknown) {
      console.error("Transaction error:", err);

      // Fix #6 - Better error handling for balance issues in submit flow
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (err instanceof Error) {
        if (err.message.includes("User declined") || err.message.includes("rejected")) {
          errorMessage = "Transaction was cancelled. Please try again.";
        } else if (err.message.includes("insufficient") || err.message.includes("balance")) {
          errorMessage =
            "Insufficient balance. Your balance may have changed. Please try a smaller amount.";
        } else if (err.message.includes("timeout")) {
          errorMessage = "Transaction timed out. Please try again.";
        } else if (err.message.includes("network") || err.message.includes("connectivity")) {
          errorMessage = "Network connection issue. Please check your connection and try again.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setStructuredError({
        message: errorMessage,
        details: err instanceof Error ? err.stack || err.message : String(err),
        code: (err as any)?.code || (err as any)?.status?.toString(),
      });
      setTransactionState("error");
      setIsConfirmationOpen(true);
      // Call onError callback if provided
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const handleRetry = () => {
    setError(null);
    setTransactionState("idle");
  };

  const handleClose = () => {
    // Prevent closing during signing/submitting
    if (transactionState === "signing" || transactionState === "submitting") {
      return;
    }
    onClose();
  };

  const currentConfirmationState = transactionState === "success" ? "success" : "error";

  const getStateMessage = () => {
    switch (transactionState) {
      case "building":
        return "Building transaction...";
      case "signing":
        return "Please approve the transaction in your wallet";
      case "submitting":
        return "Submitting transaction to network...";
      case "success":
        return "Tip sent successfully!";
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
            {transactionState === "success"
              ? "Your tip has been sent successfully!"
              : `Send a tip to @${recipientUsername}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Recipient Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={recipientAvatar} alt={recipientUsername} />
              <AvatarFallback>
                {recipientUsername.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">@{recipientUsername}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {recipientPublicKey}
              </p>
            </div>

            {/* Amount Summary */}
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
                  <span className="font-semibold">
                    {fee.toFixed(7)} XLM
                  </span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>
                    {(parseFloat(amount) + fee).toFixed(7)} XLM
                  </span>
                </div>
              </div>
            )}

            {/* State Messages */}
            {isProcessing && (
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <p className="text-sm text-blue-500">{getStateMessage()}</p>
              </div>
            )}

            {/* Error Message (validation or transaction error) */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Fix #5 - Price fetch failure warning */}
          {priceFetchFailed && !isLoadingPrice && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                Unable to load current XLM price. USD conversion unavailable.
              </p>
            </div>
          )}

          {/* Preset Amounts */}
          <div className="space-y-2">
            <Label>Select Amount</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((presetAmount) => (
                <Button
                  key={presetAmount}
                  variant={amount === presetAmount.toString() ? "default" : "outline"}
                  onClick={() => handlePresetClick(presetAmount)}
                  disabled={isProcessing}
                  className="font-semibold"
                >
                  {presetAmount} XLM
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label htmlFor="custom-amount">Or Enter Custom Amount</Label>
            <div className="relative">
              <Input
                id="custom-amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
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

          {/* Amount Summary */}
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
                <span className="font-semibold">
                  {fee.toFixed(7)} XLM
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span>Total:</span>
                <span>
                  {(parseFloat(amount) + fee).toFixed(7)} XLM
                </span>
              </div>
            </div>
          )}

          {/* State Messages */}
          {isProcessing && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <p className="text-sm text-blue-500">{getStateMessage()}</p>
            </div>
          )}

          {/* Error Message */}
          {error && transactionState === "error" && !isConfirmationOpen && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-500">{error}</p>
              </div>
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

      <TipConfirmation
        isOpen={isConfirmationOpen}
        onClose={() => {
          setIsConfirmationOpen(false);
          if (transactionState === "success") {
            onClose();
          }
        }}
        state={currentConfirmationState}
        amount={amount}
        recipientUsername={recipientUsername}
        txHash={txHash || undefined}
        error={structuredError || undefined}
        onRetry={() => {
          setIsConfirmationOpen(false);
          handleRetry();
        }}
        onSendAnother={() => {
          setIsConfirmationOpen(false);
          resetModal();
        }}
      />
    </Dialog>
  );
}
