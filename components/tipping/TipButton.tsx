"use client";

import { Gift, Loader2 } from "lucide-react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useTipModal } from "@/hooks/useTipModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TipButtonProps {
  recipientUsername: string;
  recipientPublicKey: string;
  variant?: "primary" | "secondary" | "icon-only";
  className?: string;
  onTipClick?: () => void;
}

/**
 * A reusable button component for initiating tips to streamers.
 * Handles wallet connection states and triggers the tip modal.
 */
export function TipButton({
  recipientUsername,
  recipientPublicKey,
  variant = "primary",
  className,
  onTipClick,
}: TipButtonProps) {
  const { isConnected, isConnecting, connect } = useStellarWallet();
  const { openTipModal } = useTipModal();

  const isDisabled = !recipientPublicKey;

  const handleClick = async () => {
    if (!isConnected) {
      await connect();
    } else {
      if (onTipClick) {
        onTipClick();
      }
      openTipModal();
    }
  };

  const getButtonContent = () => {
    if (isConnecting) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {variant !== "icon-only" && "Connecting..."}
        </>
      );
    }

    if (!isConnected) {
      return (
        <>
          <Gift className={cn("h-4 w-4", variant !== "icon-only" && "mr-2")} />
          {variant !== "icon-only" && "Connect Wallet"}
        </>
      );
    }

    return (
      <>
        <Gift className={cn("h-4 w-4", variant !== "icon-only" && "mr-2")} />
        {variant !== "icon-only" && "Send Tip"}
      </>
    );
  };

  const buttonVariant = variant === "icon-only" ? "outline" : variant === "secondary" ? "secondary" : "default";
  const buttonSize = variant === "icon-only" ? "icon" : "default";

  return (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      className={cn(className)}
      disabled={isDisabled || isConnecting}
      onClick={handleClick}
      aria-label={variant === "icon-only" ? `Send tip to ${recipientUsername}` : undefined}
      title={isDisabled ? "Recipient has no Stellar public key" : undefined}
    >
      {getButtonContent()}
    </Button>
  );
}
