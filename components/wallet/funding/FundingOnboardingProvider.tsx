"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import useSWR from "swr";
import { usePathname } from "next/navigation";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useTransak } from "@/hooks/useTransak";
import {
  fundingReducer,
  initialFundingMachine,
  type FundingMachine,
} from "@/lib/onboarding/funding-machine";
import { FundingWizard } from "./FundingWizard";

/**
 * First-time custodial wallet funding (#1424): wires the server's funding
 * status, the funding state machine and the existing Transak integration
 * together, and renders the wizard. The navbar entry point
 * (FundWalletEntry) reads the same context, so a user who defers can pick
 * the flow back up at any time.
 *
 * Only Google (Privy) sign-ins can have a custodial wallet, so no status is
 * fetched for wallet-extension users.
 */

export interface FundingStatus {
  walletType: "custodial" | "external" | "none";
  address: string | null;
  activated?: boolean;
  balance?: string;
  eligible: boolean;
}

interface FundingOnboardingContextValue {
  machine: FundingMachine;
  address: string | null;
  /** The Transak widget is showing (the wizard hides meanwhile). */
  widgetOpen: boolean;
  open: () => void;
  close: () => void;
  next: () => void;
  back: () => void;
  defer: () => void;
  startFunding: () => void;
}

const FundingOnboardingContext =
  createContext<FundingOnboardingContextValue | null>(null);

export function useFundingOnboarding(): FundingOnboardingContextValue | null {
  return useContext(FundingOnboardingContext);
}

const STATUS_URL = "/api/wallet/funding-status";
/** How often the balance is re-checked while a purchase is pending. */
export const PENDING_POLL_MS = 15_000;
/** After this long a pending purchase is treated as stalled. */
export const PENDING_STALL_MS = 30 * 60_000;
/** "Maybe later" hides the automatic prompt (not the entry point) this long. */
export const DEFER_MS = 7 * 24 * 60 * 60_000;
/** Pages where the wizard never opens by itself. */
const SKIP_PREFIXES = ["/onboarding", "/settings", "/admin"];

const deferKey = (address: string) =>
  `streamfi_funding_deferred_until:${address}`;
const pendingKey = (address: string) => `streamfi_funding_pending:${address}`;

// Storage can be unavailable (private mode, blocked site data): never let
// that break the page, just forget the preference.
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function readPending(
  address: string
): { orderId: string | null; since: number } | null {
  const raw = readStorage(pendingKey(address));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { orderId?: unknown; since?: unknown };
    return typeof parsed.since === "number"
      ? {
          orderId: typeof parsed.orderId === "string" ? parsed.orderId : null,
          since: parsed.since,
        }
      : null;
  } catch {
    return null;
  }
}

async function fetchStatus(url: string): Promise<FundingStatus> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`funding status ${res.status}`);
  }
  return res.json();
}

export function FundingOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { privyWallet } = useStellarWallet();
  const pathname = usePathname() ?? "";
  const [machine, dispatch] = useReducer(fundingReducer, initialFundingMachine);
  const autoOpened = useRef(false);

  const { data: status } = useSWR<FundingStatus>(
    privyWallet ? STATUS_URL : null,
    fetchStatus,
    {
      refreshInterval: machine.state === "pending" ? PENDING_POLL_MS : 0,
      revalidateOnFocus: machine.state === "pending",
      // A Horizon outage (503) must not show anything; try again later.
      shouldRetryOnError: false,
    }
  );
  const address = status?.walletType === "custodial" ? status.address : null;

  useEffect(() => {
    if (!status) {
      return;
    }
    const custodial = status.walletType === "custodial" && !!status.address;
    const deferredUntil = custodial
      ? Number(readStorage(deferKey(status.address!)) ?? 0)
      : 0;
    dispatch({
      type: "STATUS",
      eligible: custodial && status.eligible,
      funded: custodial && status.activated === true,
      deferred: Date.now() < deferredUntil,
      pendingOrder: custodial ? readPending(status.address!) : null,
    });
  }, [status]);

  // Remember a pending purchase across reloads, and forget it once resolved.
  useEffect(() => {
    if (!address) {
      return;
    }
    if (machine.state === "pending" && machine.pendingSince !== null) {
      writeStorage(
        pendingKey(address),
        JSON.stringify({
          orderId: machine.orderId,
          since: machine.pendingSince,
        })
      );
    } else if (
      machine.state === "success" ||
      machine.state === "failed" ||
      machine.state === "not_applicable"
    ) {
      writeStorage(pendingKey(address), null);
    }
  }, [address, machine.state, machine.orderId, machine.pendingSince]);

  useEffect(() => {
    if (machine.state !== "pending" || machine.pendingSince === null) {
      return;
    }
    const remaining = machine.pendingSince + PENDING_STALL_MS - Date.now();
    if (remaining <= 0) {
      dispatch({ type: "PENDING_STALLED" });
      return;
    }
    const timer = setTimeout(
      () => dispatch({ type: "PENDING_STALLED" }),
      remaining
    );
    return () => clearTimeout(timer);
  }, [machine.state, machine.pendingSince]);

  // Offer the wizard once per visit to an eligible user who has not
  // deferred it; after that the entry point is the way back in.
  useEffect(() => {
    if (
      machine.state === "eligible" &&
      !autoOpened.current &&
      !SKIP_PREFIXES.some(prefix => pathname.startsWith(prefix))
    ) {
      autoOpened.current = true;
      dispatch({ type: "OPEN" });
    }
  }, [machine.state, pathname]);

  const { openTransak, isOpen: widgetOpen } = useTransak({
    walletAddress: address,
    onOrderCreated: order =>
      dispatch({
        type: "ORDER_CREATED",
        orderId: order.id ?? null,
        at: Date.now(),
      }),
    onSuccess: order =>
      dispatch({
        type: "ORDER_SUCCESSFUL",
        orderId: order.id ?? null,
        at: Date.now(),
      }),
    onOrderFailed: () => dispatch({ type: "ORDER_FAILED" }),
    onOrderCancelled: () => dispatch({ type: "ORDER_CANCELLED" }),
    onClose: () => dispatch({ type: "WIDGET_CLOSED" }),
    onError: () => dispatch({ type: "TRANSAK_UNAVAILABLE" }),
  });

  const startFunding = useCallback(() => {
    // Only open Transak when the machine allows a purchase now; in
    // particular never while an earlier purchase is still pending.
    if (
      fundingReducer(machine, { type: "START_FUNDING" }).state !== "funding"
    ) {
      return;
    }
    dispatch({ type: "START_FUNDING" });
    void openTransak();
  }, [machine, openTransak]);

  const defer = useCallback(() => {
    if (address) {
      writeStorage(deferKey(address), String(Date.now() + DEFER_MS));
    }
    dispatch({ type: "DEFER" });
  }, [address]);

  const value = useMemo<FundingOnboardingContextValue>(
    () => ({
      machine,
      address,
      widgetOpen,
      open: () => dispatch({ type: "OPEN" }),
      close: () => dispatch({ type: "CLOSE" }),
      next: () => dispatch({ type: "NEXT" }),
      back: () => dispatch({ type: "BACK" }),
      defer,
      startFunding,
    }),
    [machine, address, widgetOpen, defer, startFunding]
  );

  return (
    <FundingOnboardingContext.Provider value={value}>
      {children}
      <FundingWizard />
    </FundingOnboardingContext.Provider>
  );
}
