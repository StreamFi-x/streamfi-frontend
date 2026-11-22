"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import {
  getMainnetGuardState,
  type MainnetGuardOptions,
} from "@/lib/stellar/network-guard";

interface MainnetSafetyBannerProps {
  guardOptions?: MainnetGuardOptions;
}

export function MainnetSafetyBanner({
  guardOptions,
}: MainnetSafetyBannerProps) {
  const state = getMainnetGuardState(guardOptions);

  if (!state.isMainnetInNonProd) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="mainnet-safety-banner"
      className="sticky top-0 z-[100] w-full border-b-2 border-red-400 bg-red-600 px-4 py-3 text-white shadow-lg"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 sm:items-center">
        {state.isBlocked ? (
          <ShieldAlert
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-white sm:mt-0"
            aria-hidden="true"
          />
        ) : (
          <AlertTriangle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-200 sm:mt-0"
            aria-hidden="true"
          />
        )}
        <div className="flex-1 text-sm leading-snug">
          <p className="font-bold uppercase tracking-wide">
            {state.isBlocked
              ? `MAINNET TRANSACTIONS BLOCKED (${state.deploymentContext} environment)`
              : `WARNING: STELLAR MAINNET ACTIVE IN ${state.deploymentContext.toUpperCase()} ENVIRONMENT`}
          </p>
          {state.warningMessage && (
            <p className="mt-0.5 text-xs text-red-100 sm:text-sm">
              {state.warningMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
