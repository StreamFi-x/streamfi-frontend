"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Share2,
  Loader2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStellarExplorerUrl } from "@/lib/stellar/config";
import type { TransactionConfirmationProgress } from "@/lib/stellar/tx-confirmation";

interface TipConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  state: "confirming" | "success" | "error";
  amount?: string;
  recipientUsername?: string;
  txHash?: string;
  confirmationProgress?: TransactionConfirmationProgress | null;
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
  onRetry?: () => void;
  onSendAnother?: () => void;
}

export function TipConfirmation({
  isOpen,
  onClose,
  state,
  amount,
  recipientUsername,
  txHash,
  confirmationProgress,
  error,
  onRetry,
  onSendAnother,
}: TipConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isConfirming = state === "confirming";
  const isSuccess = state === "success";
  const explorerUrl = txHash ? getStellarExplorerUrl("tx", txHash) : null;
  const attempt = confirmationProgress?.attempt ?? 0;
  const maxAttempts = confirmationProgress?.maxAttempts ?? 30;
  const progressPercent =
    attempt > 0
      ? Math.min(95, Math.max(15, Math.round((attempt / maxAttempts) * 100)))
      : 15;

  const handleCopyHash = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    const text = `I just sent a tip to @${recipientUsername} on StreamFi! 🚀`;
    const url = window.location.origin;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open && !isConfirming) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px] overflow-hidden">
        <AnimatePresence mode="wait">
          {isConfirming ? (
            <motion.div
              key="confirming"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
              data-testid="tip-confirmation-pending"
            >
              <DialogHeader>
                <DialogTitle className="text-center text-2xl font-bold flex flex-col items-center gap-4">
                  <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-highlight/10 border border-highlight/30">
                    <Loader2 className="w-10 h-10 text-highlight animate-spin" />
                  </div>
                  Confirming on Stellar...
                </DialogTitle>
                <DialogDescription className="text-center text-base">
                  Your tip of <strong>{amount} XLM</strong> to{" "}
                  <strong>@{recipientUsername}</strong> has been submitted.
                  Waiting for ledger confirmation.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-1">
                {/* Step indicator */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="flex items-center gap-1 text-green-500 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Submitted
                  </span>
                  <span className="flex items-center gap-1 text-highlight font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Confirming
                  </span>
                  <span className="text-muted-foreground">Confirmed</span>
                </div>

                {/* Progress bar */}
                <div
                  className="w-full h-2 bg-muted rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Transaction confirmation progress"
                >
                  <div
                    className="h-full bg-highlight transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  {attempt > 0
                    ? `Checking Stellar ledger (attempt ${attempt} of ${maxAttempts})...`
                    : "Broadcasting transaction to Stellar Horizon..."}
                </p>

                {txHash && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Transaction Hash
                    </p>
                    <div className="flex items-center gap-2 p-2.5 bg-muted rounded-lg">
                      <code className="flex-1 text-xs truncate font-mono text-muted-foreground">
                        {txHash}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:bg-background"
                        onClick={handleCopyHash}
                        aria-label="Copy transaction hash"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {explorerUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 hover:bg-background"
                          asChild
                        >
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View on Stellar Explorer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <DialogHeader>
                <DialogTitle className="text-center text-2xl font-bold flex flex-col items-center gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      damping: 12,
                      stiffness: 200,
                      delay: 0.1,
                    }}
                  >
                    <CheckCircle2 className="w-20 h-20 text-green-500" />
                  </motion.div>
                  Tip Sent Successfully!
                </DialogTitle>
                <DialogDescription className="text-center text-base">
                  You&apos;ve successfully tipped <strong>{amount} XLM</strong>{" "}
                  to <strong>@{recipientUsername}</strong>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {txHash && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Transaction Hash
                    </p>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg group">
                      <code className="flex-1 text-xs truncate font-mono text-muted-foreground">
                        {txHash}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-background"
                        onClick={handleCopyHash}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-background"
                        asChild
                      >
                        <a
                          href={explorerUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-col gap-2">
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className="w-full"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  {onSendAnother && (
                    <Button onClick={onSendAnother} className="w-full">
                      Send Another
                    </Button>
                  )}
                </div>
                <Button onClick={onClose} variant="ghost" className="w-full">
                  Close
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <DialogHeader>
                <DialogTitle className="text-center text-2xl font-bold flex flex-col items-center gap-4">
                  <motion.div
                    initial={{ rotate: -10, scale: 0.9 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 10, stiffness: 200 }}
                  >
                    <XCircle className="w-20 h-20 text-red-500" />
                  </motion.div>
                  Transaction Failed
                </DialogTitle>
                <DialogDescription className="text-center text-base text-red-500 font-medium">
                  {error?.message ||
                    "Something went wrong while processing your tip."}
                </DialogDescription>
              </DialogHeader>

              {error?.code === "wallet_disconnected" && (
                <div
                  role="alert"
                  data-testid="wallet-disconnect-guidance"
                  className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left"
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">
                      Your wallet disconnected during this tip.
                    </p>
                    <p className="text-muted-foreground">
                      Unlock or reconnect your wallet, then try the tip again. No funds
                      were sent unless you received a confirmed transaction hash above.
                    </p>
                  </div>
                </div>
              )}

              {txHash && explorerUrl && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Transaction Hash
                  </p>
                  <div className="flex items-center gap-2 p-2.5 bg-muted rounded-lg">
                    <code className="flex-1 text-xs truncate font-mono text-muted-foreground">
                      {txHash}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:bg-background"
                      onClick={handleCopyHash}
                      aria-label="Copy transaction hash"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:bg-background"
                      asChild
                    >
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View on Stellar Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {error?.details && (
                <div className="space-y-2 border border-border rounded-lg overflow-hidden">
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between p-3 h-auto hover:bg-muted/50"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Technical Details
                    </span>
                    {showDetails ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <AnimatePresence>
                    {showDetails && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 bg-muted/30 border-t border-border">
                          <pre className="text-[10px] font-mono whitespace-pre-wrap break-all text-muted-foreground">
                            {error.code && `Code: ${error.code}\n`}
                            {error.details}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-col gap-2">
                {onRetry && (
                  <Button onClick={onRetry} className="w-full">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full"
                  >
                    Close
                  </Button>
                  <Button variant="outline" asChild className="w-full">
                    <a
                      href="https://discord.gg/streamfi"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get Help
                    </a>
                  </Button>
                </div>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
