"use client";

import { PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTransak } from "@/hooks/useTransak";
import type { TransakOrderData, TransakWidgetParams } from "@/types/transak";

interface AddFundsButtonProps {
  walletAddress: string | null;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** Called after a successful on-ramp order is confirmed by Transak */
  onSuccess?: (order: TransakOrderData) => void;
  /** Optional widget URL param overrides (e.g. cryptoCurrencyCode: "USDC") */
  paramOverrides?: Partial<TransakWidgetParams>;
}

/**
 * AddFundsButton — opens the Transak on-ramp widget for the given
 * Stellar wallet address.  Returns null when no wallet is connected
 * so callers don't need to guard against it.
 */
export function AddFundsButton({
  walletAddress,
  variant = "default",
  size = "default",
  className,
  onSuccess,
  paramOverrides,
}: AddFundsButtonProps) {
  const { openTransak, isOpen } = useTransak({
    walletAddress,
    paramOverrides,
    onSuccess: order => {
      toast.success(
        `Successfully purchased ${order.cryptoAmount} ${order.cryptoCurrency}`
      );
      onSuccess?.(order);
    },
  });

  if (!walletAddress) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={openTransak}
      disabled={isOpen}
      className={className}
    >
      <PlusCircle className="w-4 h-4 mr-2" />
      {isOpen ? "Opening..." : "Add Funds"}
    </Button>
  );
}
