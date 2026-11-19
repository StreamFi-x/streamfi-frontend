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
 * Transak.on() is global. Only one widget owns events at a time. The v4 SDK
 * removes ALL listeners on close/cleanup, so reset registration on disposal.
 */
let activeOwner: {
  callbacks: { current: Callbacks };
  onClose: () => void;
} | null = null;
let listenersRegistered = false;
let openingOwner: object | null = null;

function disposeWidget(widget: WidgetInstance | null): void {
  try {
    if (widget?.close) {
      widget.close();
    } else {
      widget?.cleanup();
    }
  } finally {
    if (widget) {
      listenersRegistered = false;
    }
  }
}

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
        activeOwner?.callbacks.current.onOrderCreated?.(order);
      }
    });
    Transak.on(EVENTS.TRANSAK_ORDER_SUCCESSFUL, payload => {
      const order = orderOf(payload);
      if (order) {
        activeOwner?.callbacks.current.onSuccess?.(order);
      }
    });
    Transak.on(EVENTS.TRANSAK_ORDER_FAILED, payload => {
      activeOwner?.callbacks.current.onOrderFailed?.(orderOf(payload));
    });
    Transak.on(EVENTS.TRANSAK_ORDER_CANCELLED, payload => {
      activeOwner?.callbacks.current.onOrderCancelled?.(orderOf(payload));
    });
    Transak.on(EVENTS.TRANSAK_WIDGET_CLOSE, () => {
      const onClose = activeOwner?.onClose;
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
  const mountedRef = useRef(true);
  const openingRef = useRef(false);
  // Latest callbacks, so events never reach a stale closure.
  const callbacksRef = useRef<Callbacks>(callbacks);
  callbacksRef.current = callbacks;

  const handleClosed = useCallback(() => {
    if (!transakRef.current && activeOwner?.callbacks !== callbacksRef) {
      return;
    }
    const widget = transakRef.current;
    transakRef.current = null;
    if (mountedRef.current) {
      setIsOpen(false);
    }
    if (activeOwner?.callbacks === callbacksRef) {
      activeOwner = null;
    }
    try {
      disposeWidget(widget);
    } finally {
      callbacksRef.current.onClose?.();
    }
  }, []);

  const closeTransak = useCallback(() => {
    if (openingOwner === callbacksRef) {
      openingOwner = null;
    }
    handleClosed();
  }, [handleClosed]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (openingOwner === callbacksRef) {
        openingOwner = null;
      }
      if (activeOwner?.callbacks === callbacksRef) {
        activeOwner = null;
      }
      const widget = transakRef.current;
      transakRef.current = null;
      disposeWidget(widget);
    };
  }, []);

  const openTransak = useCallback(async () => {
    const fail = (error: Error) => {
      if (mountedRef.current) {
        callbacksRef.current.onError?.(error);
      }
      return false;
    };
    if (!mountedRef.current) {
      return false;
    }
    if (openingRef.current || openingOwner || activeOwner) {
      return fail(new Error("A Transak widget is already open or opening"));
    }
    if (!walletAddress) {
      return fail(new Error("A wallet address is required to add funds"));
    }

    let config;
    try {
      config = buildTransakConfig(walletAddress, paramOverrides);
    } catch (err) {
      return fail(err instanceof Error ? err : new Error(String(err)));
    }

    openingRef.current = true;
    openingOwner = callbacksRef;
    try {
      const Transak = await loadTransak();
      if (!mountedRef.current || openingOwner !== callbacksRef) {
        return false;
      }
      activeOwner = { callbacks: callbacksRef, onClose: handleClosed };
      const transak = new Transak(config) as unknown as WidgetInstance;
      transakRef.current = transak;
      transak.init();
      if (transakRef.current === transak) {
        setIsOpen(true);
      }
      return true;
    } catch (err) {
      const widget = transakRef.current;
      transakRef.current = null;
      if (activeOwner?.callbacks === callbacksRef) {
        activeOwner = null;
      }
      try {
        disposeWidget(widget);
      } catch {
        /* Preserve the initialization error. */
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    } finally {
      openingRef.current = false;
      if (openingOwner === callbacksRef) {
        openingOwner = null;
      }
    }
  }, [walletAddress, paramOverrides, handleClosed]);

  return { openTransak, closeTransak, isOpen };
}

export function resetTransakListenersForTests(): void {
  activeOwner = null;
  listenersRegistered = false;
  openingOwner = null;
}
