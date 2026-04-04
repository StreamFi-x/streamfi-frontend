"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings, X, Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { getStellarExplorerUrl } from "@/lib/stellar/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StreamSettings() {
  const { publicKey, privyWallet } = useStellarWallet();
  const walletAddress = publicKey || privyWallet?.wallet || null;
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  const [accessType, setAccessType] = useState<"public" | "paid">("public");
  const [priceUsdc, setPriceUsdc] = useState<string>("25.00");
  const [paidViewers, setPaidViewers] = useState<number>(0);
  const [earnedUsdc, setEarnedUsdc] = useState<string>("0");
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const earningsText = useMemo(() => {
    if (accessType !== "paid") {
      return null;
    }
    return `${paidViewers} viewers paid · $${earnedUsdc} earned`;
  }, [accessType, paidViewers, earnedUsdc]);

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

  useEffect(() => {
    if (!walletAddress) {
      return;
    }
    const load = async () => {
      try {
        setAccessError(null);
        const res = await fetch(
          `/api/streams/access/config?wallet=${encodeURIComponent(walletAddress)}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load access settings");
        }
        const data = await res.json();
        setAccessType(data.access_type === "paid" ? "paid" : "public");
        setPriceUsdc(data.config?.price_usdc ?? "25.00");
        setPaidViewers(data.stats?.paid_viewers ?? 0);
        setEarnedUsdc(data.stats?.earned_usdc ?? "0");
      } catch (e) {
        setAccessError(
          e instanceof Error ? e.message : "Failed to load settings"
        );
      }
    };
    void load();
  }, [walletAddress]);

  const saveAccess = async () => {
    if (!walletAddress) {
      return;
    }
    setIsSavingAccess(true);
    setAccessError(null);
    try {
      const res = await fetch("/api/streams/access/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          access_type: accessType,
          price_usdc: priceUsdc,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save access settings");
      }

      // Refresh stats after save
      const statsRes = await fetch(
        `/api/streams/access/config?wallet=${encodeURIComponent(walletAddress)}`
      );
      if (statsRes.ok) {
        const data = await statsRes.json();
        setPaidViewers(data.stats?.paid_viewers ?? 0);
        setEarnedUsdc(data.stats?.earned_usdc ?? "0");
      }
    } catch (e) {
      setAccessError(
        e instanceof Error ? e.message : "Failed to save settings"
      );
    } finally {
      setIsSavingAccess(false);
    }
  };

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

            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Stream access
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={accessType === "public" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAccessType("public")}
                >
                  Public
                </Button>
                <Button
                  type="button"
                  variant={accessType === "paid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAccessType("paid")}
                >
                  Paid
                </Button>
              </div>

              {accessType === "paid" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        Price (USDC, min $1, max $999)
                      </p>
                      <Input
                        value={priceUsdc}
                        onChange={e => setPriceUsdc(e.target.value)}
                        inputMode="decimal"
                        placeholder="25.00"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Viewers pay once and can rewatch the recording.
                  </p>
                  {earningsText && (
                    <p className="text-xs text-muted-foreground">
                      {earningsText}
                    </p>
                  )}
                </div>
              )}

              {accessError && (
                <p className="text-xs text-red-500" role="alert">
                  {accessError}
                </p>
              )}

              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={isSavingAccess}
                onClick={() => void saveAccess()}
              >
                {isSavingAccess ? "Saving…" : "Save access settings"}
              </Button>
            </div>
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
