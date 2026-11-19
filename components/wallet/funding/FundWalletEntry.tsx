"use client";

import { Loader2, PlusCircle } from "lucide-react";
import { showsEntryPoint } from "@/lib/onboarding/funding-machine";
import { useFundingOnboarding } from "./FundingOnboardingProvider";

/**
 * Persistent way back into the funding onboarding (#1424). Shown only while
 * a custodial wallet still needs its first funds (including after "Maybe
 * later"), and gone once the wallet is funded.
 */
export function FundWalletEntry() {
  const ctx = useFundingOnboarding();
  if (!ctx || !showsEntryPoint(ctx.machine)) {
    return null;
  }
  const pending = ctx.machine.state === "pending";
  return (
    <button
      type="button"
      onClick={ctx.open}
      className="flex items-center gap-1.5 rounded-md border border-highlight/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-highlight/10"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <PlusCircle className="h-3.5 w-3.5 text-highlight" />
      )}
      <span className="hidden sm:inline">
        {pending ? "Funding pending" : "Fund your wallet"}
      </span>
      <span className="sm:hidden">{pending ? "Pending" : "Fund"}</span>
    </button>
  );
}
