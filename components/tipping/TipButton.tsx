"use client";

import { Gift, Loader2 } from "lucide-react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useTipModal } from "@/hooks/useTipModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TipButtonProps {
  recipientUsername: string;
  recipientPublicKey: string;
  variant?: "primary" | "secondary" | "icon-only" | "outline";
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
  size,
  showIcon = true,
  disabled: disabledProp,
  className,
  onTipClick,
}: TipButtonProps) {
  const { isConnected, isConnecting, connect } = useStellarWallet();
  const { openTipModal } = useTipModal();

  const isDisabled = !recipientPublicKey || disabledProp === true;

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

  const showLabel = variant !== "icon-only";
  const iconClass = cn("h-4 w-4", showLabel && "mr-2");

  const getButtonContent = () => {
    if (isConnecting) {
      return (
        <>
          {showIcon && <Loader2 className={iconClass + " animate-spin"} />}
          {showLabel && "Connecting..."}
        </>
      );
    }

    if (!isConnected) {
      return (
        <>
          {showIcon && <Gift className={iconClass} />}
          {showLabel && "Connect Wallet"}
        </>
      );
    }

    return (
      <>
        {showIcon && <Gift className={iconClass} />}
        {showLabel && "Send Tip"}
      </>
    );
  };

  const buttonVariant =
    variant === "icon-only" || variant === "outline" ? "outline" : variant === "secondary" ? "secondary" : "default";
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
