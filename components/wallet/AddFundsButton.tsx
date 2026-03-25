"use client";

import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AddFundsButtonProps {
  walletAddress: string | null;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AddFundsButton({
  walletAddress,
  variant = "default",
  size = "default",
  className,
}: AddFundsButtonProps) {
  if (!walletAddress) {
    return null;
  }

  const handleClick = () => {
    const url = new URL("https://global.transak.com/");
    url.searchParams.set("walletAddress", walletAddress);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
    >
      <PlusCircle className="w-4 h-4 mr-2" />
      Add Funds
    </Button>
  );
}
