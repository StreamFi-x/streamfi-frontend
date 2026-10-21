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
  checkAccountBalance,
  AccountNotFundedError,
  getXLMPrice,
  calculateFeeEstimate,
  getRecommendedFeeStroops,
  MAX_TIP_AMOUNT_XLM,
  MIN_TIP_AMOUNT_XLM,
} from "@/lib/stellar/payments";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { TipConfirmation } from "./TipConfirmation";
import { sessionReplay } from "@/lib/session-replay";

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

interface Quote {
  quote_token: string;
  quoted_rate: number;
  quoted_xlm_amount: number;
  expires_at: string;
}

const PRESET_AMOUNTS = [1, 5, 10, 25];
const MAX_TIP_AMOUNT = MAX_TIP_AMOUNT_XLM;
const MIN_TIP_AMOUNT = MIN_TIP_AMOUNT_XLM;

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
  const [amount, setAmount] = useState<string>("");
  const [transactionState, setTransactionState] =
    useState<TransactionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [xlmPrice, setXlmPrice] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [priceFetchFailed, setPriceFetchFailed] = useState<boolean>(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [structuredError, setStructuredError] = useState<{
    message: string;
    details?: string;
    code?: string;
  } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteCountdown, setQuoteCountdown] = useState<number>(0);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [quoteFetchFailed, setQuoteFetchFailed] = useState<boolean>(false);

  const { kit } = useStellarWallet();
  const [feeStroops, setFeeStroops] = useState<number | undefined>(undefined);
  const fee = calculateFeeEstimate(feeStroops);
  const usdEquivalent =
    xlmPrice && amount ? (parseFloat(amount) * xlmPrice).toFixed(2) : "0.00";

  const getQuote = async (amountXlm: string) => {
    if (!amountXlm || parseFloat(amountXlm) <= 0) {
      setQuote(null);
      setQuoteCountdown(0);
      return;
    }

    setIsLoadingQuote(true);
    setQuoteFetchFailed(false);

    try {
      // Parse amount to get fiat cents
      const xlmAmount = parseFloat(amountXlm);
      const currentRate = xlmPrice || 0.08; // Fallback rate
      const fiatCents = Math.round(xlmAmount * currentRate * 100);

      const response = await fetch("/api/tips/get-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiat_amount_cents: fiatCents,
          creator_id: senderPublicKey, // Use sender as a proxy; ideally this comes from context
        }),
      });

      if (!response.ok) {
        console.error("Failed to fetch quote:", response.status);
        setQuoteFetchFailed(true);
        setQuote(null);
        return;
      }

      const quoteData = (await response.json()) as any;
      setQuote({
        quote_token: quoteData.quote_token,
        quoted_rate: quoteData.quoted_rate,
        quoted_xlm_amount: quoteData.quoted_xlm_amount,
        expires_at: quoteData.expires_at,
      });
      setQuoteCountdown(300); // 5 minutes
      setQuoteFetchFailed(false);
    } catch (err) {
      console.error("Error fetching quote:", err);
      setQuoteFetchFailed(true);
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsLoadingPrice(true);
      setPriceFetchFailed(false);
      // Cached for 30s in payments.ts and falls back to the network minimum
      // if Horizon is unreachable, so this never blocks or throws.
      getRecommendedFeeStroops()
        .then(setFeeStroops)
        .catch(() => undefined);
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

  // Countdown timer for quote expiry
  useEffect(() => {
    if (quoteCountdown <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setQuoteCountdown(prev => {
        if (prev <= 1) {
          setQuote(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quoteCountdown]);

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
    setQuote(null);
    setQuoteCountdown(0);
    setQuoteFetchFailed(false);
  };

  const handlePresetClick = (presetAmount: number) => {
    sessionReplay.addBreadcrumb({
      category: "tipping",
      message: `Selected preset tip amount: ${presetAmount} XLM`,
      level: "info",
      data: { presetAmount, recipient: recipientUsername },
    });
    setAmount(presetAmount.toString());
    setError(null);
    getQuote(presetAmount.toString());
  };

  const handleAmountChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
      if (value !== "") {
        sessionReplay.addBreadcrumb({
          category: "tipping",
          message: `Custom tip amount entered: ${value} XLM`,
          level: "info",
          data: { amount: value, recipient: recipientUsername },
        });
        getQuote(value);
      } else {
        setQuote(null);
        setQuoteCountdown(0);
      }
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
    sessionReplay.addBreadcrumb({
      category: "tipping",
      message: `Submitting tip: ${amount} XLM to @${recipientUsername}`,
      level: "info",
      data: {
        amount,
        recipientUsername,
        recipientPublicKey: `${recipientPublicKey.slice(0, 4)}...${recipientPublicKey.slice(-4)}`,
        senderPublicKey: `${senderPublicKey.slice(0, 4)}...${senderPublicKey.slice(-4)}`,
      },
    });

    if (!validateAmount()) {
      sessionReplay.addBreadcrumb({
        category: "tipping",
        message: "Tip validation failed",
        level: "warning",
        data: { amount },
      });
      return;
    }

    setError(null);
    let stage: TransactionState = "building";

    try {
      setTransactionState("building");
      sessionReplay.addBreadcrumb({
        category: "tipping",
        message: "Building tip transaction and checking fee",
        level: "info",
      });
      // One fee for both the balance check and the transaction, so they
      // cannot disagree if the network fee moves in between.
      const currentFeeStroops = await getRecommendedFeeStroops();
      setFeeStroops(currentFeeStroops);
      try {
        const insufficientBalance = await hasInsufficientBalance(
          senderPublicKey,
          amount,
          currentFeeStroops
        );

        if (insufficientBalance) {
          setError("insufficient_balance");
          setTransactionState("error");
          sessionReplay.recordFlowError("tipping", new Error("Insufficient balance"), {
            amount,
            feeStroops: currentFeeStroops,
          });
          if (onError) {
            onError("Insufficient balance");
          }
          return;
        }
      } catch (err: unknown) {
        if (err instanceof AccountNotFundedError) {
          setError("sender_not_funded");
          setTransactionState("error");
          sessionReplay.recordFlowError("tipping", err, {
            amount,
            stage: "sender_funding_check",
          });
          if (onError) {
            onError(err.message);
          }
          return;
        }
        throw err;
      }

      // Check recipient account funding status
      const recipientCheck = await checkAccountBalance(recipientPublicKey, "0");
      if (recipientCheck.status === "account_not_funded") {
        setError("recipient_not_funded");
        setTransactionState("error");
        sessionReplay.recordFlowError("tipping", new Error("Recipient account is not funded"), {
          recipientPublicKey: `${recipientPublicKey.slice(0, 4)}...${recipientPublicKey.slice(-4)}`,
        });
        if (onError) {
          onError("Recipient account is not funded on the Stellar network.");
        }
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
        feeStroops: currentFeeStroops,
      });

      stage = "signing";
      setTransactionState("signing");
      sessionReplay.addBreadcrumb({
        category: "tipping",
        message: "Prompting wallet signature",
        level: "info",
        data: { network },
      });
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

      stage = "submitting";
      setTransactionState("submitting");
      sessionReplay.addBreadcrumb({
        category: "tipping",
        message: "Submitting signed transaction to Stellar network",
        level: "info",
      });
      const result = await submitTransaction(
        signedTransaction as any,
        network as "testnet" | "mainnet"
      );

      if (result.success) {
        sessionReplay.addBreadcrumb({
          category: "tipping",
          message: `Tip transaction successful: ${result.hash}`,
          level: "info",
          data: { txHash: result.hash },
        });
        setTransactionState("success");
        setTxHash(result.hash ?? null);
        setIsConfirmationOpen(true);
        if (onSuccess && result.hash) {
          onSuccess(result.hash, amount);
        }
      } else {
        throw result.error
          ? new Error(result.error)
          : new Error("Transaction failed");
      }
    } catch (err: unknown) {
      console.error("Transaction error:", err);

      sessionReplay.recordFlowError("tipping", err, {
        amount,
        recipientUsername,
        stage,
      });

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
      setStructuredError({
        message: errorMessage,
        details: err instanceof Error ? err.stack || err.message : String(err),
        code: (err as any)?.code || (err as any)?.status?.toString(),
      });
      setTransactionState("error");
      setIsConfirmationOpen(true);
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
    if (transactionState === "signing" || transactionState === "submitting") {
      return;
    }
    onClose();
  };

  const currentConfirmationState =
    transactionState === "success" ? "success" : "error";

  const getStateMessage = () => {
    switch (transactionState) {
      case "building":
        return "Building transaction...";
      case "signing":
        return "Please approve the transaction in your wallet";
      case "submitting":
        return "Submitting to Stellar network...";
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
      <DialogContent className="sm:max-w-[440px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg font-bold">
            Send a Tip
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {transactionState === "success"
              ? "Your tip has been sent!"
              : `Supporting @${recipientUsername} with XLM`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Recipient row */}
          <div className="flex items-center gap-3 p-3 bg-secondary border border-border rounded-xl">
            <Avatar className="h-11 w-11 ring-2 ring-highlight/20">
              <AvatarImage src={recipientAvatar} alt={recipientUsername} />
              <AvatarFallback className="bg-highlight/10 text-highlight font-semibold">
                {recipientUsername.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                @{recipientUsername}
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                {recipientPublicKey.slice(0, 14)}…
                {recipientPublicKey.slice(-10)}
              </p>
            </div>
          </div>

          {/* XLM price warning */}
          {priceFetchFailed && !isLoadingPrice && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-500">
                Unable to load XLM price — USD estimate unavailable.
              </p>
            </div>
          )}

          {/* Preset amounts */}
          <div className="space-y-2">
            <Label className="text-foreground text-sm font-medium">
              Select Amount
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map(presetAmount => (
                <Button
                  key={presetAmount}
                  variant="outline"
                  onClick={() => handlePresetClick(presetAmount)}
                  disabled={isProcessing}
                  className={
                    amount === presetAmount.toString()
                      ? "border-highlight bg-highlight/10 text-highlight hover:bg-highlight/20 font-bold"
                      : "border-border text-muted-foreground hover:border-highlight/50 hover:text-foreground"
                  }
                >
                  {presetAmount}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-2">
            <Label
              htmlFor="custom-amount"
              className="text-foreground text-sm font-medium"
            >
              Custom Amount
            </Label>
            <div className="relative">
              <Input
                id="custom-amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                disabled={isProcessing}
                className="pr-14 bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-highlight/60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                XLM
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Max: {MAX_TIP_AMOUNT.toLocaleString()} XLM
            </p>
          </div>

          {/* Amount breakdown */}
          {amount !== "" && parseFloat(amount) > 0 && (
            <div className="space-y-2 p-3 bg-secondary border border-border rounded-xl text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tip amount</span>
                <span className="font-semibold text-foreground">
                  {amount} XLM
                </span>
              </div>
              {xlmPrice > 0 && !isLoadingPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">≈ USD</span>
                  <span className="text-muted-foreground">
                    ${usdEquivalent}
                  </span>
                </div>
              )}
              {quote && quoteCountdown > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Locked rate</span>
                  <span className="font-semibold text-highlight">
                    ${quote.quoted_rate} /XLM
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network fee</span>
                <span className="text-muted-foreground">
                  {fee.toFixed(7)} XLM
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-highlight">
                  {(parseFloat(amount) + fee).toFixed(7)} XLM
                </span>
              </div>
              {quote && quoteCountdown > 0 && (
                <div className="text-xs text-amber-600 pt-2 border-t border-border">
                  Quote expires in {Math.floor(quoteCountdown / 60)}:
                  {String(quoteCountdown % 60).padStart(2, "0")}
                </div>
              )}
              {quoteFetchFailed && (
                <div className="text-xs text-destructive pt-2 border-t border-border">
                  Failed to fetch exchange rate quote
                </div>
              )}
            </div>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="flex items-center gap-2.5 p-3 bg-highlight/10 border border-highlight/20 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin text-highlight flex-shrink-0" />
              <p className="text-sm text-highlight">{getStateMessage()}</p>
            </div>
          )}

          {/* Validation / transaction error */}
          {error && transactionState === "error" && !isConfirmationOpen && (
            <div className="flex items-start gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                {error === "insufficient_balance" ? (
                  <>
                    <p className="text-sm text-destructive">
                      Insufficient balance — you don&apos;t have enough XLM to
                      cover this tip and the network fee.
                    </p>
                    <AddFundsButton
                      walletAddress={senderPublicKey}
                      variant="outline"
                      size="sm"
                      className="border-highlight/40 text-highlight hover:bg-highlight/10 h-8 text-xs"
                    />
                  </>
                ) : error === "sender_not_funded" ? (
                  <>
                    <p className="text-sm text-destructive">
                      Your Stellar account is not yet funded or activated. You
                      need a minimum balance of 1 XLM to activate it.
                    </p>
                    <AddFundsButton
                      walletAddress={senderPublicKey}
                      variant="outline"
                      size="sm"
                      className="border-highlight/40 text-highlight hover:bg-highlight/10 h-8 text-xs"
                    />
                  </>
                ) : error === "recipient_not_funded" ? (
                  <p className="text-sm text-destructive">
                    Recipient&apos;s wallet has not yet been activated on
                    Stellar. An account requires a minimum balance of 1 XLM
                    before it can receive standard payment transfers.
                  </p>
                ) : (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
            </div>
          )}

          {/* Inline validation error (idle state) */}
          {error && transactionState === "idle" && (
            <div className="flex items-start gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1 border-border text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isProcessing}
              className="flex-1 bg-highlight hover:bg-highlight/90 text-white font-semibold"
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
