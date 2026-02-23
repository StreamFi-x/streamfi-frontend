"use client";

import React, { useState, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
    TrendingUp,
    Coins,
    Clock,
    Copy,
    Check,
    RefreshCcw,
    AlertCircle,
    Gift,
    ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// --- Interfaces ---

export interface TipCounterProps {
    username: string;
    variant?: 'compact' | 'default' | 'large';
    showRefreshButton?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
    className?: string;
}

export interface TipStatistics {
    totalReceived: string;
    totalCount: number;
    lastTipAt: string | null;
    stellarPublicKey: string;
}

// --- Helpers ---

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatXLM = (amount: string) => {
    const num = parseFloat(amount || "0");
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 7,
        maximumFractionDigits: 7,
    }).format(num);
};

const formatCount = (count: number) => {
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        compactDisplay: "short",
    }).format(count);
};

// --- Sub-components ---

export const TipCounterSkeleton = ({ variant }: { variant: 'compact' | 'default' | 'large' }) => {
    return (
        <div className={cn(
            "animate-pulse bg-card/50 border border-border rounded-xl",
            variant === 'compact' ? "p-3 h-16 w-full" :
                variant === 'large' ? "p-8 h-64 w-full" : "p-6 h-40 w-full"
        )}>
            <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-24 bg-muted rounded-md" />
                <div className="h-8 w-8 bg-muted rounded-full" />
            </div>
            <div className="space-y-3">
                <div className="h-10 w-48 bg-muted rounded-md" />
                <div className="h-4 w-32 bg-muted rounded-md" />
            </div>
        </div>
    );
};

export const TipCounterError = ({ message, onRetry }: { message: string, onRetry: () => void }) => {
    return (
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm font-medium text-destructive-foreground">{message}</p>
            <button
                onClick={onRetry}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-xs font-semibold hover:bg-destructive/90 transition-colors"
            >
                Retry
            </button>
        </div>
    );
};

export const TipCounterEmpty = ({ variant, username }: { variant: 'compact' | 'default' | 'large', username: string }) => {
    return (
        <div className={cn(
            "bg-card/30 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center",
            variant === 'compact' ? "p-3 h-16" :
                variant === 'large' ? "p-10 h-64" : "p-6 h-40"
        )}>
            <Gift className={cn("text-muted-foreground/30", variant === 'compact' ? "w-4 h-4 mb-1" : "w-10 h-10 mb-3")} />
            <p className={cn("text-muted-foreground font-medium", variant === 'compact' ? "text-[10px]" : "text-sm")}>
                No tips received yet.
            </p>
            {variant !== 'compact' && (
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
                    Share your profile link to start receiving tips from your fans!
                </p>
            )}
        </div>
    );
};

// --- Main Component ---

export function TipCounter({
    username,
    variant = 'default',
    showRefreshButton = false,
    autoRefresh = false,
    refreshInterval = 30000,
    className
}: TipCounterProps) {
    const [xlmPrice, setXlmPrice] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { data, error, isLoading, mutate: revalidate } = useSWR(
        `/api/users/${username}/stats`,
        fetcher,
        {
            refreshInterval: autoRefresh ? refreshInterval : 0,
        }
    );

    const fetchPrice = useCallback(async () => {
        try {
            const res = await fetch("https://api.coinbase.com/v2/prices/XLM-USD/spot");
            const json = await res.json();
            setXlmPrice(parseFloat(json.data.amount));
        } catch (err) {
            console.error("Failed to fetch XLM price", err);
        }
    }, []);

    useEffect(() => {
        fetchPrice();
        const interval = setInterval(fetchPrice, 60000); // Update price every minute
        return () => clearInterval(interval);
    }, [fetchPrice]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            // Requirements specify POST /api/tips/refresh-total
            await fetch("/api/tips/refresh-total", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username })
            });
            await revalidate();
        } catch (err) {
            console.error("Refresh failed", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading) return <TipCounterSkeleton variant={variant} />;
    if (error || (data && data.error)) return <TipCounterError message={data?.error || "Failed to load stats"} onRetry={() => revalidate()} />;

    const stats: TipStatistics = data;

    if (parseInt(stats.totalCount.toString()) === 0 && parseFloat(stats.totalReceived) === 0) {
        return <TipCounterEmpty variant={variant} username={username} />;
    }

    const usdValue = xlmPrice ? (parseFloat(stats.totalReceived) * xlmPrice).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
    }) : null;

    const lastTipReceived = stats.lastTipAt
        ? formatDistanceToNow(new Date(stats.lastTipAt), { addSuffix: true })
        : null;

    // --- Variant Renders ---

    if (variant === 'compact') {
        return (
            <div className={cn(
                "bg-card/40 backdrop-blur-md border border-border rounded-lg p-2 flex items-center justify-between gap-3 group transition-all hover:bg-card/60",
                className
            )}>
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-highlight/10 text-highlight">
                        <Coins className="w-3 h-3" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-foreground">
                            {formatXLM(stats.totalReceived)} <span className="text-[10px] text-muted-foreground font-medium">XLM</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5" />
                            {formatCount(stats.totalCount)} tips
                        </div>
                    </div>
                </div>

                {showRefreshButton && (
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        aria-label="Refresh stats"
                        className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground disabled:opacity-50"
                    >
                        <RefreshCcw className={cn("w-3 h-3 text-highlight", isRefreshing && "animate-spin")} />
                    </button>
                )}
            </div>
        );
    }

    if (variant === 'large') {
        return (
            <div className={cn(
                "bg-gradient-to-br from-card via-card to-highlight/5 border border-border rounded-2xl p-8 relative overflow-hidden group shadow-xl",
                className
            )}>
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-highlight/5 rounded-full blur-3xl pointer-events-none group-hover:bg-highlight/10 transition-colors duration-500" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-highlight/10 text-highlight shadow-inner">
                                <Coins className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Earnings Overview</h3>
                                <p className="text-sm text-muted-foreground">Total tips received via Stellar</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {showRefreshButton && (
                                <button
                                    onClick={handleManualRefresh}
                                    disabled={isRefreshing}
                                    aria-label="Refresh stats"
                                    className="flex items-center gap-2 px-4 py-2 bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold transition-all backdrop-blur-sm disabled:opacity-50"
                                >
                                    <RefreshCcw className={cn("w-4 h-4", isRefreshing && "animate-spin text-highlight")} />
                                    Refresh
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-1">
                            <div className="text-4xl font-black tracking-tight text-foreground flex items-baseline gap-2">
                                {formatXLM(stats.totalReceived)}
                                <span className="text-lg font-bold text-highlight">XLM</span>
                            </div>
                            <div className="flex items-center gap-2 h-6">
                                <AnimatePresence mode="wait">
                                    {usdValue ? (
                                        <motion.span
                                            key="usd-value"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-sm font-medium text-muted-foreground/80 flex items-center gap-1"
                                        >
                                            ≈ {usdValue} USD
                                        </motion.span>
                                    ) : (
                                        <div key="placeholder" className="w-24 h-4 bg-muted animate-pulse rounded" />
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="bg-background/40 backdrop-blur-md rounded-2xl p-5 border border-border/50 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground/60 mb-1">Total Contributions</p>
                                <div className="text-3xl font-black text-foreground">{formatCount(stats.totalCount)}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-highlight/5">
                                <TrendingUp className="w-6 h-6 text-highlight" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                            <Clock className="w-4 h-4" />
                            {lastTipReceived ? `Last tip received ${lastTipReceived}` : 'No recent tips'}
                        </div>

                        <button
                            onClick={() => handleCopy(stats.stellarPublicKey)}
                            aria-label="Copy public key"
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-background border border-border hover:border-highlight/30 hover:bg-highlight/5 rounded-xl transition-all group/copy"
                        >
                            <span className="text-xs font-mono text-muted-foreground group-hover/copy:text-foreground">
                                {stats.stellarPublicKey.slice(0, 8)}...{stats.stellarPublicKey.slice(-8)}
                            </span>
                            {copied ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4 text-muted-foreground group-hover/copy:text-highlight transition-colors" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Default Variant
    return (
        <div className={cn(
            "bg-card/40 backdrop-blur-lg border border-border rounded-xl p-6 transition-all hover:bg-card/50",
            className
        )}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-highlight/10 text-highlight">
                        <Coins className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Total Received</span>
                </div>
                {showRefreshButton && (
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        aria-label="Refresh stats"
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground disabled:opacity-50"
                    >
                        <RefreshCcw className={cn("w-4 h-4", isRefreshing && "animate-spin text-highlight")} />
                    </button>
                )}
            </div>

            <div className="mb-4">
                <div className="text-2xl font-bold flex items-baseline gap-1 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    {formatXLM(stats.totalReceived)}
                    <span className="text-xs font-bold text-highlight">XLM</span>
                </div>
                <div className="h-5">
                    <AnimatePresence mode="wait">
                        {usdValue ? (
                            <motion.span
                                key="usd-value"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs text-muted-foreground font-medium"
                            >
                                ≈ {usdValue} USD
                            </motion.span>
                        ) : (
                            <div key="placeholder" className="w-16 h-3 bg-muted animate-pulse rounded mt-1" />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium pt-4 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5 text-highlight" />
                    {formatCount(stats.totalCount)} Tips
                </div>
                <button
                    onClick={() => handleCopy(stats.stellarPublicKey)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-highlight transition-colors"
                >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    Copy Address
                </button>
            </div>
        </div>
    );
}
