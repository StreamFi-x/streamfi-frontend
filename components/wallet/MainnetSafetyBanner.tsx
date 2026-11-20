"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useOptionalStellarWallet } from "@/contexts/stellar-wallet-context";
import type { StellarNetworkGuardState } from "@/lib/stellar/network-guard";

interface MainnetSafetyBannerProps {
  guardState?: StellarNetworkGuardState;
}

export function MainnetSafetyBanner({
  guardState,
}: MainnetSafetyBannerProps = {}) {
  const wallet = useOptionalStellarWallet();
  const guard = guardState ?? wallet?.networkGuard;

  if (!guard || !guard.isUnsafeMainnetConfig) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="mainnet-safety-banner"
      className="sticky top-0 z-50 w-full bg-red-700 text-white border-b-2 border-red-900 px-4 py-3 shadow-md"
    >
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        {guard.isTransactionBlocked ? (
          <ShieldAlert
            className="w-5 h-5 shrink-0 mt-0.5 text-red-100"
            aria-hidden="true"
          />
        ) : (
          <AlertTriangle
            className="w-5 h-5 shrink-0 mt-0.5 text-amber-200"
            aria-hidden="true"
          />
        )}
        <div className="flex-1 text-sm leading-snug">
          <p className="font-bold tracking-wide uppercase">
            {guard.isTransactionBlocked
              ? "MAINNET SAFETY GUARD ACTIVE - REAL TRANSACTIONS BLOCKED"
              : "WARNING: STELLAR MAINNET ACTIVE IN NON-PRODUCTION ENVIRONMENT"}
          </p>
          <p className="text-red-100 mt-0.5">
            Deployment context:{" "}
            <span className="font-semibold">{guard.deploymentContext}</span> |
            Network: <span className="font-semibold">{guard.network}</span>.{" "}
            {guard.reason}
          </p>
        </div>
      </div>
    </div>
  );
}
