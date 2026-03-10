"use client";

import { useState } from "react";
import { Settings, X, Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { getStellarExplorerUrl } from "@/lib/stellar/config";

export default function StreamSettings() {
  const { publicKey, privyWallet } = useStellarWallet();
  const walletAddress = publicKey || privyWallet?.wallet || null;
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (!walletAddress) {
      return;
    }
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = walletAddress
    ? getStellarExplorerUrl("account", walletAddress)
    : null;

  if (isMinimized) {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <Settings className="w-4 h-4" />
          <span>Show Tip Wallet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Tip Wallet
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 hover:bg-muted rounded-md transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {walletAddress ? (
          <>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Stellar Address
              </p>
              <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-lg px-3 py-2">
                <p className="flex-1 text-[11px] font-mono truncate text-foreground">
                  {walletAddress}
                </p>
                <button
                  onClick={copyAddress}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Copy address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-highlight transition-colors"
                    aria-label="View on Stellar Expert"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <Link
              href="/dashboard/payout"
              className="block w-full text-center py-2 text-xs font-semibold bg-highlight/10 hover:bg-highlight/20 text-highlight rounded-lg transition-colors"
            >
              View Wallet &amp; Earnings →
            </Link>
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            No wallet connected
          </p>
        )}
      </div>
    </div>
  );
}
