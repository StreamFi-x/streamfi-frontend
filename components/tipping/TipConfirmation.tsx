"use client";

import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TipConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  state: "success" | "error";
  amount?: string;
  txHash?: string;
  error?: string;
  onSendAnother?: () => void;
  recipientUsername?: string;
}

export function TipConfirmation({
  isOpen,
  onClose,
  state,
  amount,
  txHash,
  error,
  onSendAnother,
  recipientUsername,
}: TipConfirmationProps) {
  const isSuccess = state === "success";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isSuccess ? "Tip Sent Successfully!" : "Tip Failed"}
          </DialogTitle>
          <DialogDescription>
            {isSuccess
              ? `Your tip to ${recipientUsername || "the streamer"} was sent successfully.`
              : "There was an error processing your tip."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          {isSuccess ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              {amount && (
                <div className="text-center space-y-2">
                  <p className="font-semibold text-lg">{amount} XLM sent!</p>
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
              )}
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-red-500" />
              {error && (
                <div className="text-center">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {isSuccess ? (
            <div className="flex gap-2 w-full">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Close
              </Button>
              {onSendAnother && (
                <Button onClick={onSendAnother} className="flex-1">
                  Send Another
                </Button>
              )}
            </div>
          ) : (
            <div className="flex gap-2 w-full">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Close
              </Button>
              {onSendAnother && (
                <Button onClick={onSendAnother} className="flex-1">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
