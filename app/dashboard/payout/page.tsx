"use client";

import { useEffect, useState, useCallback } from "react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import useSWR from "swr";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TipCounter } from "@/components/tipping";
import { AddFundsButton } from "@/components/wallet/AddFundsButton";
import { TRANSAK_ORDER_COMPLETE_EVENT } from "@/hooks/useTransak";
import {
  Wallet,
  Copy,
  Check,
  ExternalLink,
  RefreshCcw,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStellarExplorerUrl } from "@/lib/stellar/config";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PayoutPage() {
  const { publicKey, privyWallet } = useStellarWallet();
  const walletAddress = publicKey || privyWallet?.wallet || null;
  const [username, setUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [xlmPrice, setXlmPrice] = useState<number | null>(null);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
      return;
    }
    if (privyWallet?.username) {
      setUsername(privyWallet.username);
    }
  }, [privyWallet]);

  const { data: userData } = useSWR(
    !username && walletAddress ? `/api/users/wallet/${walletAddress}` : null,
    fetcher
  );

  useEffect(() => {
    if (userData?.user?.username) {
      setUsername(userData.user.username);
    }
  }, [userData]);

  const effectiveUsername = username || walletAddress || "User";
  const isPrivyUser = !!privyWallet;

  // Live balance from Horizon via server-side proxy
  const {
    data: balanceData,
    error: balanceError,
    isLoading: balanceLoading,
    mutate: refreshBalance,
  } = useSWR(
    walletAddress ? `/api/wallet/balance?address=${walletAddress}` : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/prices/xlm");
      if (!res.ok) {
        throw new Error();
      }
      const json = await res.json();
      setXlmPrice(json.price);
    } catch {
      if (!xlmPrice) {
        setXlmPrice(0.08);
      }
    }
  }, [xlmPrice]);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  // Refresh balance automatically after a completed Transak order
  useEffect(() => {
    const handler = () => {
      void refreshBalance();
    };
    window.addEventListener(TRANSAK_ORDER_COMPLETE_EVENT, handler);
    return () =>
      window.removeEventListener(TRANSAK_ORDER_COMPLETE_EVENT, handler);
  }, [refreshBalance]);

  const handleCopy = () => {
    if (!walletAddress) {
      return;
    }
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const balance = balanceData?.balance ?? null;
  const unfunded = balanceData?.unfunded === true;
  const balanceNum = parseFloat(balance ?? "0");
  const usdValue =
    balance && xlmPrice
      ? (balanceNum * xlmPrice).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        })
      : null;

  const explorerUrl = walletAddress
    ? getStellarExplorerUrl("account", walletAddress)
    : null;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 space-y-6 bg-secondary">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-foreground">
          Wallet &amp; Payouts
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Your Stellar wallet balance and tip earnings.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wallet Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex flex-col gap-3"
        >
          <div className="bg-gradient-to-br from-card via-card to-highlight/5 border border-border rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-48 h-48 rounded-full bg-highlight/5 blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-5">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-highlight/10 text-highlight">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    Stellar Balance
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {walletAddress && (
                    <AddFundsButton
                      walletAddress={walletAddress}
                      email={privyWallet?.email ?? undefined}
                      isPrivyUser={isPrivyUser}
                    />
                  )}
                  <button
                    onClick={() => refreshBalance()}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                    aria-label="Refresh balance"
                  >
                    <RefreshCcw
                      className={cn(
                        "w-4 h-4",
                        balanceLoading && "animate-spin text-highlight"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Balance amount */}
              {balanceLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-10 w-40 bg-muted rounded-lg" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </div>
              ) : balanceError ? (
                <div className="flex items-center gap-2 text-destructive text-sm py-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Failed to load balance</span>
                </div>
              ) : unfunded ? (
                <div className="space-y-1">
                  <p className="text-3xl font-black text-foreground">
                    0{" "}
                    <span className="text-lg text-highlight font-bold">
                      XLM
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Account not yet activated on the Stellar network
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-3xl font-black text-foreground flex items-baseline gap-2">
                    {balanceNum.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                    <span className="text-lg font-bold text-highlight">
                      XLM
                    </span>
                  </div>
                  <AnimatePresence mode="wait">
                    {usdValue ? (
                      <motion.p
                        key="usd"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-muted-foreground font-medium"
                      >
                        ≈ {usdValue} USD
                      </motion.p>
                    ) : (
                      <div
                        key="ph"
                        className="h-4 w-20 bg-muted animate-pulse rounded mt-1"
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Wallet address row */}
              {walletAddress && (
                <div className="pt-4 border-t border-border/50 flex items-center justify-between gap-2">
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {walletAddress.slice(0, 12)}...{walletAddress.slice(-10)}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={handleCopy}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      aria-label="Copy wallet address"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-highlight"
                        aria-label="View on Stellar Expert"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Privy custodial wallet notice */}
          {isPrivyUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-start gap-2.5 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <p className="text-xs text-blue-300 leading-relaxed">
                This is your custodial Stellar wallet managed by StreamFi. To
                send or withdraw funds, export your private key from{" "}
                <Link
                  href="/settings/privacy"
                  className="underline font-semibold hover:text-blue-100 transition-colors"
                >
                  Settings → Privacy &amp; Security
                </Link>{" "}
                and import it into a wallet like{" "}
                <a
                  href="https://www.freighter.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold hover:text-blue-100 transition-colors"
                >
                  Freighter
                </a>
                .
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Earnings Overview — TipCounter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {effectiveUsername !== "User" ? (
            <TipCounter
              username={effectiveUsername}
              variant="large"
              showRefreshButton={true}
              autoRefresh={true}
              refreshInterval={60000}
              walletAddress={walletAddress ?? undefined}
            />
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-8 h-full flex items-center justify-center text-muted-foreground text-sm animate-pulse">
              Loading earnings...
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
