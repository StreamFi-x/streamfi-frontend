"use client";

import { Button } from "@/components/ui/button";

export function AddFundsButton(props: {
  walletAddress: string;
  paramOverrides?: Record<string, string>;
  className?: string;
  children?: React.ReactNode;
}) {
  const { walletAddress, paramOverrides, className, children } = props;

  const params = new URLSearchParams({
    walletAddress,
    ...(paramOverrides ?? {}),
  });

  const href = `https://global.transak.com/?${params.toString()}`;

  return (
    <Button asChild variant="outline" className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children ?? "Add funds"}
      </a>
    </Button>
  );
}

