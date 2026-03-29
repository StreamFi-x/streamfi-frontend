"use client";

import { useCallback, useRef, useState } from "react";
import type {
  TransakOrderData,
  TransakEventPayload,
  TransakWidgetParams,
} from "@/types/transak";
import { buildTransakConfig } from "@/lib/transak/config";

interface UseTransakOptions {
  walletAddress: string | null;
  /** Called when the user completes a successful purchase */
  onSuccess?: (order: TransakOrderData) => void;
  /** Called when the widget is closed (success or not) */
  onClose?: () => void;
  /** Optional overrides for widget URL params (e.g. cryptoCurrencyCode: "USDC") */
  paramOverrides?: Partial<TransakWidgetParams>;
}

export interface UseTransakReturn {
  openTransak: () => Promise<void>;
  closeTransak: () => void;
  isOpen: boolean;
}

type TransakSdkModule = typeof import("@transak/transak-sdk");

async function loadTransakSdk(): Promise<TransakSdkModule> {
  const dynamicImport = new Function(
    "modulePath",
    "return import(modulePath);"
  ) as (modulePath: string) => Promise<TransakSdkModule>;

  return dynamicImport("@transak/transak-sdk");
}

/**
 * useTransak — manages the Transak v4 on-ramp widget lifecycle.
 *
 * v4 differences from older versions:
 * - All payment params go into the widgetUrl query string (not the config object)
 * - Transak.on() is a STATIC method — registered once, not per instance
 * - SDK is dynamically imported to keep it out of the SSR bundle
 */
export function useTransak({
  walletAddress,
  onSuccess,
  onClose,
  paramOverrides,
}: UseTransakOptions): UseTransakReturn {
  const [isOpen, setIsOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transakRef = useRef<any>(null);
  const listenersRegistered = useRef(false);

  const closeTransak = useCallback(() => {
    if (transakRef.current) {
      transakRef.current.cleanup();
      transakRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const openTransak = useCallback(async () => {
    if (!walletAddress) {
      console.warn("useTransak: walletAddress is required to open the widget");
      return;
    }

    let config;
    try {
      config = buildTransakConfig(walletAddress, paramOverrides);
    } catch (err) {
      console.error("useTransak: failed to build config —", err);
      return;
    }

    // Dynamic import keeps the SDK out of the SSR bundle
    const { Transak } = await loadTransakSdk();

    // In v4, Transak.on() is static — register listeners only once
    if (!listenersRegistered.current) {
      Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => {
        transakRef.current = null;
        setIsOpen(false);
        onClose?.();
      });

      Transak.on(
        Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL,
        (payload: unknown) => {
          const data = payload as TransakEventPayload;
          onSuccess?.(data.status);
        }
      );

      listenersRegistered.current = true;
    }

    const transak = new Transak(config);
    transakRef.current = transak;
    transak.init();
    setIsOpen(true);
  }, [walletAddress, paramOverrides, onSuccess, onClose]);

  return { openTransak, closeTransak, isOpen };
}
