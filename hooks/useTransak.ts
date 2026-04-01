"use client";

import { useCallback, useState } from "react";
import type { TransakCryptoCurrency, TransakOrderData } from "@/types/transak";

export const TRANSAK_ORDER_COMPLETE_EVENT = "TRANSAK_ORDER_SUCCESS";

type UseTransakOptions = {
  walletAddress: string;
  email?: string;
  onOrderComplete?: (order: TransakOrderData) => void;
  onError?: (message: string) => void;
};

/**
 * Opens Transak in a new tab with StreamFi defaults.
 * Full widget SDK can replace this later; order completion is not observed for the tab flow.
 */
export function useTransak({
  walletAddress,
  email,
  onOrderComplete,
  onError,
}: UseTransakOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openTransak = useCallback(
    (currency: TransakCryptoCurrency, extraParams?: Record<string, string>) => {
      const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY;
      if (!apiKey) {
        const msg =
          "Transak API key is not configured. Set NEXT_PUBLIC_TRANSAK_API_KEY.";
        setError(msg);
        onError?.(msg);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          apiKey,
          walletAddress,
          defaultCryptoCurrency: currency,
          ...(email ? { email } : {}),
          ...(extraParams ?? {}),
        });
        const href = `https://global.transak.com/?${params.toString()}`;
        window.open(href, "_blank", "noopener,noreferrer");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to open Transak";
        setError(msg);
        onError?.(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress, email, onError, onOrderComplete]
  );

  return { openTransak, isLoading, error };
}
