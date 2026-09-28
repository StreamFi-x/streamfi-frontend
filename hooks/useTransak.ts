"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  TransakOrderData,
  TransakEventPayload,
  TransakWidgetParams,
} from "@/types/transak";
import { buildTransakConfig } from "@/lib/transak/config";

interface UseTransakOptions {
  walletAddress: string | null;
  /**
   * Transak completed the order on its side. The crypto may still be on its
   * way to the wallet; confirm with the wallet balance before telling the
   * user the funds have arrived.
   */
  onSuccess?: (order: TransakOrderData) => void;
  /** Transak took an order (payment started). */
  onOrderCreated?: (order: TransakOrderData) => void;
  onOrderFailed?: (order: TransakOrderData | null) => void;
  onOrderCancelled?: (order: TransakOrderData | null) => void;
  /** Called when the widget is closed (success or not) */
  onClose?: () => void;
  /** The widget could not be opened (e.g. Transak is not configured). */
  onError?: (error: Error) => void;
  /** Optional overrides for widget URL params (e.g. cryptoCurrencyCode: "USDC") */
  paramOverrides?: Partial<TransakWidgetParams>;
}

export interface UseTransakReturn {
  /** Resolves false when the widget could not be opened. */
  openTransak: () => Promise<boolean>;
  closeTransak: () => void;
  isOpen: boolean;
}

type Callbacks = Omit<UseTransakOptions, "walletAddress" | "paramOverrides">;

interface WidgetInstance {
  init(): void;
  cleanup(): void;
  close?: () => void;
}

/**
 * Transak.on() is static and has no "off", so listeners are registered once
 * per page and forward events to whichever hook instance opened the widget.
 * (Registering per instance made every event fire every instance's handlers.)
 */
let activeCallbacks: { current: Callbacks } | null = null;
let activeOnClose: (() => void) | null = null;
let listenersRegistered = false;

function orderOf(payload: unknown): TransakOrderData | null {
  return (payload as TransakEventPayload | null)?.status ?? null;
}

async function loadTransak() {
  // Dynamic import keeps the SDK out of the SSR bundle.
  const { Transak } = await import("@transak/transak-sdk");
  if (!listenersRegistered) {
    const { EVENTS } = Transak;
    Transak.on(EVENTS.TRANSAK_ORDER_CREATED, payload => {
      const order = orderOf(payload);
      if (order) {
        activeCallbacks?.current.onOrderCreated?.(order);
      }
    });
    Transak.on(EVENTS.TRANSAK_ORDER_SUCCESSFUL, payload => {
      const order = orderOf(payload);
      if (order) {
        activeCallbacks?.current.onSuccess?.(order);
      }
    });
    Transak.on(EVENTS.TRANSAK_ORDER_FAILED, payload => {
      activeCallbacks?.current.onOrderFailed?.(orderOf(payload));
    });
    Transak.on(EVENTS.TRANSAK_ORDER_CANCELLED, payload => {
      activeCallbacks?.current.onOrderCancelled?.(orderOf(payload));
    });
    Transak.on(EVENTS.TRANSAK_WIDGET_CLOSE, () => {
      const onClose = activeOnClose;
      activeOnClose = null;
      onClose?.();
    });
    listenersRegistered = true;
  }
  return Transak;
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
  paramOverrides,
  ...callbacks
}: UseTransakOptions): UseTransakReturn {
  const [isOpen, setIsOpen] = useState(false);
  const transakRef = useRef<WidgetInstance | null>(null);
  // Latest callbacks, so events never reach a stale closure.
  const callbacksRef = useRef<Callbacks>(callbacks);
  callbacksRef.current = callbacks;

  const handleClosed = useCallback(() => {
    transakRef.current = null;
    setIsOpen(false);
    if (activeCallbacks === callbacksRef) {
      activeCallbacks = null;
    }
    callbacksRef.current.onClose?.();
  }, []);

  const closeTransak = useCallback(() => {
    const widget = transakRef.current;
    if (widget) {
      if (widget.close) {
        widget.close();
      } else {
        widget.cleanup();
      }
    }
    handleClosed();
  }, [handleClosed]);

  useEffect(
    () => () => {
      if (activeCallbacks === callbacksRef) {
        activeCallbacks = null;
        activeOnClose = null;
      }
    },
    []
  );

  const openTransak = useCallback(async () => {
    const fail = (error: Error) => {
      callbacksRef.current.onError?.(error);
      return false;
    };
    if (!walletAddress) {
      return fail(new Error("A wallet address is required to add funds"));
    }

    let config;
    try {
      config = buildTransakConfig(walletAddress, paramOverrides);
    } catch (err) {
      return fail(err instanceof Error ? err : new Error(String(err)));
    }

    let Transak;
    try {
      Transak = await loadTransak();
    } catch (err) {
      return fail(err instanceof Error ? err : new Error(String(err)));
    }

    activeCallbacks = callbacksRef;
    activeOnClose = handleClosed;
    const transak = new Transak(config) as unknown as WidgetInstance;
    transakRef.current = transak;
    transak.init();
    setIsOpen(true);
    return true;
  }, [walletAddress, paramOverrides, handleClosed]);

  return { openTransak, closeTransak, isOpen };
}

export function resetTransakListenersForTests(): void {
  activeCallbacks = null;
  activeOnClose = null;
  listenersRegistered = false;
}
