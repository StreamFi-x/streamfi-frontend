"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  PlusCircle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransak } from "@/hooks/useTransak";
import Link from "next/link";
import type { TransakCryptoCurrency, TransakOrderData } from "@/types/transak";
import { cn } from "@/lib/utils";

export interface AddFundsButtonProps {
  walletAddress: string;
  email?: string;
  isPrivyUser?: boolean;
  onOrderComplete?: (order: TransakOrderData) => void;
  className?: string;
  /** Merged into Transak query (e.g. `cryptoCurrencyCode` for deep links) */
  paramOverrides?: Record<string, string>;
  children?: ReactNode;
}

/**
 * Transak on-ramp: currency picker, USDC trustline warning, and link fallback.
 * `paramOverrides` can pin a currency (e.g. paid streams: USDC only).
 */
export function AddFundsButton({
  walletAddress,
  email,
  isPrivyUser = false,
  onOrderComplete,
  className,
  paramOverrides,
  children,
}: AddFundsButtonProps) {
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showUsdcWarning, setShowUsdcWarning] = useState(false);
  const [showPrivyToast, setShowPrivyToast] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const pinnedCurrency = useMemo((): TransakCryptoCurrency | null => {
    const code = paramOverrides?.cryptoCurrencyCode?.toUpperCase();
    if (code === "USDC") {
      return "USDC";
    }
    if (code === "XLM") {
      return "XLM";
    }
    return null;
  }, [paramOverrides]);

  const handleOrderComplete = (order: TransakOrderData) => {
    onOrderComplete?.(order);
    if (isPrivyUser) {
      setShowPrivyToast(true);
      window.setTimeout(() => setShowPrivyToast(false), 8000);
    }
  };

  const { openTransak, isLoading, error } = useTransak({
    walletAddress,
    email,
    onOrderComplete: handleOrderComplete,
    onError: message => {
      // If the error looks like a configuration / network failure, show fallback
      if (
        message.includes("not configured") ||
        message.includes("Failed to load") ||
        message.includes("API key")
      ) {
        setShowFallback(true);
      }
    },
  });

  const openWithOverrides = (currency: TransakCryptoCurrency) => {
    const rest = { ...(paramOverrides ?? {}) };
    delete rest.cryptoCurrencyCode;
    openTransak(currency, rest);
  };

  const handleCurrencySelect = (currency: TransakCryptoCurrency) => {
    setShowCurrencyPicker(false);
    if (currency === "USDC") {
      setShowUsdcWarning(true);
    } else {
      openWithOverrides("XLM");
    }
  };

  const handleUsdcProceed = () => {
    setShowUsdcWarning(false);
    openWithOverrides("USDC");
  };

  const handlePrimaryClick = () => {
    if (pinnedCurrency === "USDC") {
      setShowUsdcWarning(true);
      return;
    }
    if (pinnedCurrency === "XLM") {
      openWithOverrides("XLM");
      return;
    }
    setShowCurrencyPicker(true);
  };

  const hrefFallback = `https://global.transak.com/?${new URLSearchParams({
    walletAddress,
    ...(paramOverrides ?? {}),
  }).toString()}`;

  return (
    <div className="relative">
      <Button
        size="sm"
        onClick={handlePrimaryClick}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-1.5 bg-highlight hover:bg-highlight/90 text-white",
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <PlusCircle className="w-3.5 h-3.5" />
        )}
        {children ?? "Add Funds"}
      </Button>

      {showCurrencyPicker && (
        <div className="absolute top-full right-0 mt-2 z-50 w-48 bg-card border border-border rounded-xl shadow-lg p-2 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground px-2 py-1 font-medium">
            Select currency
          </p>
          <button
            type="button"
            onClick={() => handleCurrencySelect("XLM")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm text-left"
          >
            <span className="font-semibold text-highlight">XLM</span>
            <span className="text-muted-foreground">Stellar Lumens</span>
          </button>
          <button
            type="button"
            onClick={() => handleCurrencySelect("USDC")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm text-left"
          >
            <span className="font-semibold text-highlight">USDC</span>
            <span className="text-muted-foreground">USD Coin</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCurrencyPicker(false)}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            Cancel
          </button>
        </div>
      )}

      {showUsdcWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  USDC Trustline Required
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  To receive USDC on Stellar, your wallet must first establish a
                  trustline for the USDC asset. Without it, the deposit will
                  fail.
                </p>
              </div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4 text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
              <p className="font-medium">How to add the USDC trustline:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                <li>Open your Stellar wallet (e.g. Freighter)</li>
                <li>Go to &quot;Manage Assets&quot;</li>
                <li>Search for USDC (issued by Centre)</li>
                <li>Click &quot;Add trustline&quot;</li>
              </ol>
              <a
                href="https://stellar.expert/explorer/public/asset/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 underline mt-1"
              >
                View USDC asset on Stellar Expert
                <ExternalLink className="w-3 h-3 inline" />
              </a>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUsdcWarning(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUsdcProceed}
                className="flex-1 bg-highlight hover:bg-highlight/90 text-white"
              >
                I have a trustline
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback message (widget load failure / missing API key) */}
      {(showFallback || error) && !showUsdcWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h3 className="font-semibold text-foreground text-sm">
                  Unable to open widget
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFallback(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              The Transak widget could not be loaded. This may be due to a
              network issue, an unsupported region, or a missing API key.
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              You can still open Transak in a new tab or buy XLM on an exchange
              and send it to your wallet:
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={hrefFallback}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-highlight underline"
              >
                Open Transak <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://www.coinbase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-highlight underline"
              >
                Buy on Coinbase <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://www.kraken.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-highlight underline"
              >
                Buy on Kraken <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-4"
              onClick={() => setShowFallback(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {showPrivyToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-xs bg-card border border-border rounded-xl shadow-xl p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Funds received!
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Your purchase landed in your StreamFi custodial wallet. To
              withdraw, export your private key from{" "}
              <Link
                href="/settings/privacy"
                className="underline text-highlight"
              >
                Settings → Privacy &amp; Security
              </Link>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPrivyToast(false)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
