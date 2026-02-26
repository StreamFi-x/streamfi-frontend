"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Share2
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
import { cn } from "@/lib/utils";

interface TipConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  state: "success" | "error";
  amount?: string;
  recipientUsername?: string;
  txHash?: string;
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
  error,
  onRetry,
  onSendAnother,
}: TipConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isSuccess = state === "success";
  const explorerUrl = txHash ? getStellarExplorerUrl("tx", txHash) : null;

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden">
        <AnimatePresence mode="wait">
          {isSuccess ? (
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
                    transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                  >
                    <CheckCircle2 className="w-20 h-20 text-green-500" />
                  </motion.div>
                  Tip Sent Successfully!
                </DialogTitle>
                <DialogDescription className="text-center text-base">
                  You've successfully tipped <strong>{amount} XLM</strong> to <strong>@{recipientUsername}</strong>.
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
                        <a href={explorerUrl!} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-col gap-2">
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button variant="outline" onClick={handleShare} className="w-full">
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
                  {error?.message || "Something went wrong while processing your tip."}
                </DialogDescription>
              </DialogHeader>

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
                  <Button variant="outline" onClick={onClose} className="w-full">
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
