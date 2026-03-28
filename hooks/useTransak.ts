"use client";

import { useCallback, useRef, useState } from "react";
import { buildTransakWidgetUrl } from "@/lib/transak/config";
import type { TransakCryptoCurrency, TransakOrderData } from "@/types/transak";

/** Custom DOM event name dispatched on window after a completed Transak order */
export const TRANSAK_ORDER_COMPLETE_EVENT = "transak-order-complete";

interface UseTransakOptions {
  walletAddress: string;
  email?: string;
  /** Called when the Transak widget is closed (any reason) */
  onClose?: () => void;
  /** Called when an order reaches COMPLETED status in the widget */
  onOrderComplete?: (order: TransakOrderData) => void;
  /** Called when the widget or order fails */
  onError?: (message: string) => void;
}

interface UseTransakReturn {
  openTransak: (cryptoCurrency?: TransakCryptoCurrency) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * useTransak — dynamically imports the Transak SDK (avoids SSR), opens the
 * widget as a modal overlay, and manages event listeners for the full lifecycle.
 *
 * Uses @transak/transak-sdk v4 which accepts { widgetUrl, referrer } and
 * renders the widget in an iframe.
 *
 * On a successful order it:
 *  1. Calls `onOrderComplete` callback.
 *  2. Dispatches `transak-order-complete` CustomEvent on `window` so any
 *     listener (e.g. payout page) can react and refresh the balance.
 *  3. POSTs the order to /api/wallet/onramp/order for DB persistence.
 */
export function useTransak({
  walletAddress,
  email,
  onClose,
  onOrderComplete,
  onError,
}: UseTransakOptions): UseTransakReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transakRef = useRef<{ cleanup: () => void; close: () => void } | null>(null);

  const openTransak = useCallback(
    async (cryptoCurrency: TransakCryptoCurrency = "XLM") => {
      setIsLoading(true);
      setError(null);

      try {
        // Dynamic import so the SDK never runs server-side
        const { Transak } = await import("@transak/transak-sdk").catch(() => {
          throw new Error(
            "Failed to load Transak widget. Please check your connection."
          );
        });

        let widgetUrl: string;
        try {
          widgetUrl = buildTransakWidgetUrl({
            walletAddress,
            cryptoCurrency,
            email,
          });
        } catch (configErr) {
          throw new Error(
            configErr instanceof Error
              ? configErr.message
              : "Transak is not configured."
          );
        }

        const referrer =
          typeof window !== "undefined" ? window.location.origin : "";

        const transak = new Transak({ widgetUrl, referrer });
        transakRef.current = transak;

        transak.init();
        setIsLoading(false);

        // ── Event listeners ────────────────────────────────────────────────

        Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => {
          transak.cleanup();
          transakRef.current = null;
          onClose?.();
        });

        Transak.on(
          Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL,
          (data: unknown) => {
            // The SDK types the callback param as `unknown`; cast safely.
            const event = data as { status: TransakOrderData };
            const order = event?.status;
            if (!order) { return; }

            // 1. Notify caller
            onOrderComplete?.(order);

            // 2. Broadcast to window so any listener can react (e.g. refresh balance)
            window.dispatchEvent(
              new CustomEvent(TRANSAK_ORDER_COMPLETE_EVENT, { detail: order })
            );

            // 3. Persist order to DB (fire-and-forget; failures are non-critical here)
            fetch("/api/wallet/onramp/order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: order.id,
                status: order.status,
                cryptoAmount: order.cryptoAmount,
                cryptoCurrency: order.cryptoCurrency,
                fiatAmount: order.fiatAmount,
                fiatCurrency: order.fiatCurrency,
                walletAddress: order.walletAddress,
                txHash: order.transactionHash,
              }),
            }).catch(err =>
              console.error("[useTransak] Failed to persist order:", err)
            );
          }
        );

        Transak.on(Transak.EVENTS.TRANSAK_ORDER_FAILED, (data: unknown) => {
          const event = data as { status?: { id?: string } };
          const msg = `Transak order failed (${event?.status?.id ?? "unknown"})`;
          setError(msg);
          onError?.(msg);
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to open Transak widget.";
        setError(message);
        onError?.(message);
        setIsLoading(false);
      }
    },
    [walletAddress, email, onClose, onOrderComplete, onError]
  );

  return { openTransak, isLoading, error };
}
