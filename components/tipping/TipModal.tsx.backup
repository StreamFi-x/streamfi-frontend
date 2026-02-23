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
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import {
  buildTipTransaction,
  submitTransaction,
  hasInsufficientBalance,
  getXLMPrice,
  calculateFeeEstimate,
} from "@/lib/stellar/payments";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientUsername: string;
  recipientPublicKey: string;
  recipientAvatar?: string;
  senderPublicKey: string;
}

type TransactionState =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "success"
  | "error";

const PRESET_AMOUNTS = [1, 5, 10, 25];

export function TipModal({
  isOpen,
  onClose,
  recipientUsername,
  recipientPublicKey,
  recipientAvatar,
  senderPublicKey,
}: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [transactionState, setTransactionState] =
    useState<TransactionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [xlmPrice, setXlmPrice] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);

  // Calculate the current amount being used
  const currentAmount = customAmount || selectedAmount?.toString() || "0";
  const fee = calculateFeeEstimate();
  const usdEquivalent = xlmPrice
    ? (parseFloat(currentAmount) * xlmPrice).toFixed(2)
    : "0.00";

  // Fetch XLM price when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingPrice(true);
      getXLMPrice()
        .then((price) => setXlmPrice(price))
        .catch((err) => console.error("Failed to fetch XLM price:", err))
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
    setSelectedAmount(null);
    setCustomAmount("");
    setTransactionState("idle");
    setError(null);
    setTxHash(null);
  };

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount(""); // Clear custom amount when preset is selected
    setError(null);
  };

  const handleCustomAmountChange = (value: string) => {
    // Only allow valid decimal numbers
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCustomAmount(value);
      setSelectedAmount(null); // Clear preset selection
      setError(null);
    }
  };

  const validateAmount = (): boolean => {
    const amount = parseFloat(currentAmount);

    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return false;
    }

    if (amount < 0.0000001) {
      setError("Amount is too small. Minimum is 0.0000001 XLM");
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
        currentAmount
      );

      if (insufficientBalance) {
        setError(
          "Insufficient balance. Please ensure you have enough XLM to cover the tip and transaction fee."
        );
        setTransactionState("error");
        return;
      }

      // Build transaction
      const xdr = await buildTipTransaction(
        senderPublicKey,
        recipientPublicKey,
        currentAmount,
        `Tip to @${recipientUsername}`
      );

      // Sign and submit transaction
      setTransactionState("signing");
      const result = await submitTransaction(xdr, senderPublicKey);

      if (result.success) {
        setTransactionState("success");
        setTxHash(result.hash);
      } else {
        throw new Error("Transaction failed");
      }
    } catch (err: unknown) {
      console.error("Transaction error:", err);

      // Handle different error types
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (err instanceof Error) {
        if (err.message.includes("User declined")) {
          errorMessage = "Transaction was cancelled. Please try again.";
        } else if (err.message.includes("insufficient")) {
          errorMessage =
            "Insufficient balance. Please ensure you have enough XLM.";
        } else if (err.message.includes("timeout")) {
          errorMessage = "Transaction timed out. Please try again.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setTransactionState("error");
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

  const canSubmit =
    (selectedAmount !== null || customAmount !== "") &&
    transactionState === "idle";

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

        {transactionState === "success" ? (
          // Success State
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <div className="text-center space-y-2">
              <p className="font-semibold text-lg">
                {currentAmount} XLM sent!
              </p>
              {xlmPrice > 0 && (
                <p className="text-sm text-muted-foreground">
                  ≈ ${usdEquivalent} USD
                </p>
              )}
              {txHash && (
                <a
                  href={`${process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? "https://stellar.expert/explorer/public" : "https://stellar.expert/explorer/testnet"}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
                >
                  View on Explorer
                  <ArrowRight className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ) : (
          // Input State
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
            </div>

            {/* Preset Amounts */}
            <div className="space-y-2">
              <Label>Select Amount</Label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    onClick={() => handlePresetClick(amount)}
                    disabled={isProcessing}
                    className="font-semibold"
                  >
                    {amount} XLM
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
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  disabled={isProcessing}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  XLM
                </span>
              </div>
            </div>

            {/* Amount Summary */}
            {currentAmount !== "0" && parseFloat(currentAmount) > 0 && (
              <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold">{currentAmount} XLM</span>
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
                    {(parseFloat(currentAmount) + fee).toFixed(7)} XLM
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
            {error && transactionState === "error" && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {transactionState === "success" ? (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          ) : transactionState === "error" ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleRetry} className="flex-1">
                Try Again
              </Button>
            </div>
          ) : (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
