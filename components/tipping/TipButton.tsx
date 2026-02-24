"use client";

import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TipButtonProps {
  recipientUsername: string;
  recipientPublicKey: string;
  onTipClick: () => void;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  showIcon?: boolean;
  children?: React.ReactNode;
}

export function TipButton({
  recipientUsername,
  recipientPublicKey,
  onTipClick,
  className,
  variant = "default",
  size = "default",
  disabled = false,
  showIcon = true,
  children,
}: TipButtonProps) {
  // Validate that recipient has a public key
  if (!recipientPublicKey) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTipClick();
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled}
      className={cn("gap-2", className)}
      title={`Send a tip to ${recipientUsername}`}
    >
      {showIcon && <Gift className="w-4 h-4" />}
      {children || "Send Tip"}
    </Button>
  );
}
