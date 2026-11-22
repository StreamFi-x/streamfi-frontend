"use client";

import { AlertTriangle } from "lucide-react";
import { getStellarNetwork, type StellarNetwork } from "@/lib/stellar/config";

interface StellarNetworkBadgeProps {
  /** Override detected network (primarily useful for testing). */
  network?: StellarNetwork;
  /**
   * "pill" — compact badge suitable for headers and navbars.
   * "banner" — prominent notice bar suitable for modals (connect wallet, tipping).
   */
  variant?: "pill" | "banner";
  className?: string;
}

export function StellarNetworkBadge({
  network,
  variant = "pill",
  className = "",
}: StellarNetworkBadgeProps) {
  const activeNetwork: StellarNetwork = network ?? getStellarNetwork();
  const isTestnet = activeNetwork !== "mainnet";

  if (variant === "banner") {
    if (isTestnet) {
      return (
        <div
          data-testid="stellar-network-badge"
          data-network={activeNetwork}
          role="status"
          aria-label="Stellar network: Testnet"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-400 text-xs ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-semibold">Stellar Testnet</span>
          <span className="text-amber-300/80">
            — test XLM only, transactions have no real value
          </span>
        </div>
      );
    }

    return (
      <div
        data-testid="stellar-network-badge"
        data-network={activeNetwork}
        role="status"
        aria-label="Stellar network: Mainnet"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>Stellar Mainnet</span>
      </div>
    );
  }

  if (isTestnet) {
    return (
      <span
        data-testid="stellar-network-badge"
        data-network={activeNetwork}
        role="status"
        aria-label="Stellar network: Testnet"
        title="Connected to Stellar Testnet — test XLM only, no real value"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold tracking-wide select-none ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span>Testnet</span>
      </span>
    );
  }

  return (
    <span
      data-testid="stellar-network-badge"
      data-network={activeNetwork}
      role="status"
      aria-label="Stellar network: Mainnet"
      title="Connected to Stellar Mainnet"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium select-none ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <span>Mainnet</span>
    </span>
  );
}
