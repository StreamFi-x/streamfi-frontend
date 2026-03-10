"use client";

import { useEffect, useState } from "react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import useSWR from "swr";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    BarChart2,
    Video,
    Wallet,
    Radio,
    Users,
    Coins,
    ChevronRight,
    Play,
    Server,
    Copy,
    Check,
    Eye,
    EyeOff,
    Settings2,
    Zap,
    ExternalLink,
} from "lucide-react";
import { TipCounter } from "@/components/tipping";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardHome() {
    const { publicKey, privyWallet } = useStellarWallet();
    const walletAddress = publicKey || privyWallet?.wallet || null;
    const [username, setUsername] = useState<string | null>(null);

    // Copy states
    const [rtmpCopied, setRtmpCopied] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);
    const [keyRevealed, setKeyRevealed] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

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
        if (userData?.user?.username) setUsername(userData.user.username);
    }, [userData]);

    const effectiveUsername = username || walletAddress || "User";

    const { data: followersData } = useSWR(
        username ? `/api/users/${username}/followers` : null,
        fetcher
    );

    const { data: statsData } = useSWR(
        effectiveUsername !== "User"
            ? `/api/users/${effectiveUsername}/stats`
            : null,
        fetcher
    );

    const { data: streamKeyData } = useSWR(
        walletAddress ? `/api/streams/key?wallet=${walletAddress}` : null,
        fetcher
    );

    const followerCount: number =
        followersData?.count ?? followersData?.followers?.length ?? 0;
    const totalTips: number = statsData?.totalCount ?? 0;
    const hasStreamKey = streamKeyData?.hasStream === true;
    const streamData = streamKeyData?.streamData ?? null;

    const copy = (text: string, type: "rtmp" | "key" | "link") => {
        navigator.clipboard.writeText(text);
        if (type === "rtmp") {
            setRtmpCopied(true);
            setTimeout(() => setRtmpCopied(false), 2000);
        } else if (type === "key") {
            setKeyCopied(true);
            setTimeout(() => setKeyCopied(false), 2000);
        } else {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        }
    };

    const watchUrl = username
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/${username}/watch`
        : null;

    const quickActions = [
        {
            title: "Stream Manager",
            description: "Manage your live stream, chat, and settings",
            icon: <BarChart2 className="w-5 h-5" />,
            href: "/dashboard/stream-manager",
            gradient: "from-purple-500/15 to-transparent",
            iconBg: "bg-purple-500/10 text-purple-400",
        },
        {
            title: "Recordings",
            description: "Browse and manage your past streams",
            icon: <Video className="w-5 h-5" />,
            href: "/dashboard/recordings",
            gradient: "from-green-500/15 to-transparent",
            iconBg: "bg-green-500/10 text-green-400",
        },
        {
            title: "Wallet & Payout",
            description: "View your XLM balance and tip earnings",
            icon: <Wallet className="w-5 h-5" />,
            href: "/dashboard/payout",
            gradient: "from-yellow-500/15 to-transparent",
            iconBg: "bg-yellow-500/10 text-yellow-400",
        },
    ];

    return (
        <div className="h-full overflow-y-auto p-4 md:p-8 space-y-6 bg-secondary">
            {/* Welcome header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <h1 className="text-2xl font-bold text-foreground">
                    Welcome back{username ? `, ${username}` : ""}
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Here&apos;s an overview of your channel.
                </p>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
                <StatCard
                    icon={<Users className="w-5 h-5 text-blue-400" />}
                    label="Followers"
                    value={followerCount.toLocaleString()}
                    iconBg="bg-blue-500/10"
                />
                <StatCard
                    icon={<Coins className="w-5 h-5 text-highlight" />}
                    label="Tips Received"
                    value={totalTips.toLocaleString()}
                    iconBg="bg-highlight/10"
                />
                <StatCard
                    icon={<Radio className="w-5 h-5 text-muted-foreground" />}
                    label="Stream Status"
                    value="Offline"
                    iconBg="bg-muted"
                    valueClass="text-muted-foreground"
                />
            </motion.div>

            {/* Go Live CTA */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
            >
                <Link href="/dashboard/stream-manager" className="block group">
                    <div className="relative overflow-hidden rounded-2xl border border-highlight/30 bg-gradient-to-br from-card via-card to-highlight/10 p-6 flex items-center justify-between transition-all duration-300 hover:border-highlight/50 hover:shadow-lg hover:shadow-highlight/5">
                        <div className="absolute right-0 top-0 -mr-8 -mt-8 w-40 h-40 rounded-full bg-highlight/10 blur-2xl pointer-events-none" />
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-highlight/20 text-highlight">
                                <Play className="w-6 h-6 fill-current" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-foreground">Start Streaming</p>
                                <p className="text-sm text-muted-foreground">
                                    Go live to your audience right now
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-highlight transition-colors shrink-0" />
                    </div>
                </Link>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="space-y-3"
                >
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Quick Access
                    </h2>
                    <div className="flex flex-col gap-3">
                        {quickActions.map((action) => (
                            <Link key={action.href} href={action.href} className="block group">
                                <div
                                    className={cn(
                                        "flex items-center gap-3 p-4 rounded-xl border border-border bg-card transition-all duration-200 hover:border-border/60 hover:shadow-sm",
                                        "bg-gradient-to-r",
                                        action.gradient
                                    )}
                                >
                                    <div className={cn("p-2 rounded-lg shrink-0", action.iconBg)}>
                                        {action.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">
                                            {action.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {action.description}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </motion.div>

                {/* Tips summary (compact) */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                    className="space-y-3"
                >
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Tip Earnings
                    </h2>
                    {effectiveUsername !== "User" ? (
                        <TipCounter
                            username={effectiveUsername}
                            variant="default"
                            showRefreshButton={true}
                            autoRefresh={true}
                            refreshInterval={60000}
                        />
                    ) : (
                        <div className="bg-card border border-dashed border-border rounded-xl p-6 flex items-center justify-center text-muted-foreground text-sm">
                            Loading...
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Stream Credentials */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="space-y-3"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        OBS / Stream Credentials
                    </h2>
                    <Link
                        href="/settings/stream-preference"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        Manage in Settings
                    </Link>
                </div>

                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    {/* Watch link — always show once username is known */}
                    {watchUrl && (
                        <div>
                            <CredentialRow
                                label="Your Stream Link (share with viewers)"
                                value={watchUrl}
                                alwaysVisible
                                copied={linkCopied}
                                onCopy={() => copy(watchUrl, "link")}
                                externalHref={watchUrl}
                            />
                        </div>
                    )}

                    {/* Divider between share link and OBS credentials */}
                    {watchUrl && (
                        <hr className="border-border" />
                    )}

                    {!streamKeyData ? (
                        // Loading skeleton
                        <div className="space-y-3 animate-pulse">
                            <div className="h-10 bg-muted rounded-lg" />
                            <div className="h-10 bg-muted rounded-lg" />
                        </div>
                    ) : !hasStreamKey ? (
                        // No stream key yet
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                                    <Server className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">No stream key yet</p>
                                    <p className="text-xs text-muted-foreground">
                                        Generate one in Settings to start broadcasting with OBS
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/settings/stream-preference"
                                className="flex items-center gap-2 px-4 py-2 bg-highlight hover:bg-highlight/90 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Generate Key
                            </Link>
                        </div>
                    ) : (
                        // Has stream credentials
                        <div className="space-y-3">
                            <CredentialRow
                                label="RTMP Server"
                                value={streamData.rtmpUrl}
                                alwaysVisible
                                copied={rtmpCopied}
                                onCopy={() => copy(streamData.rtmpUrl, "rtmp")}
                            />
                            <CredentialRow
                                label="Stream Key"
                                value={streamData.streamKey}
                                alwaysVisible={false}
                                revealed={keyRevealed}
                                onToggleReveal={() => setKeyRevealed((v) => !v)}
                                copied={keyCopied}
                                onCopy={() => copy(streamData.streamKey, "key")}
                                isSecret
                            />
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

function CredentialRow({
    label,
    value,
    alwaysVisible,
    revealed,
    onToggleReveal,
    copied,
    onCopy,
    isSecret,
    externalHref,
}: {
    label: string;
    value: string;
    alwaysVisible: boolean;
    revealed?: boolean;
    onToggleReveal?: () => void;
    copied: boolean;
    onCopy: () => void;
    isSecret?: boolean;
    externalHref?: string;
}) {
    const displayValue = alwaysVisible || revealed ? value : "•".repeat(32);

    return (
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {label}
            </p>
            <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2">
                <p
                    className={cn(
                        "flex-1 text-xs font-mono truncate",
                        !alwaysVisible && !revealed
                            ? "text-muted-foreground tracking-widest"
                            : "text-foreground"
                    )}
                >
                    {displayValue}
                </p>
                {isSecret && onToggleReveal && (
                    <button
                        onClick={onToggleReveal}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={revealed ? "Hide key" : "Reveal key"}
                    >
                        {revealed ? (
                            <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                            <Eye className="w-3.5 h-3.5" />
                        )}
                    </button>
                )}
                {externalHref && (
                    <a
                        href={externalHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-highlight transition-colors"
                        aria-label="Open in new tab"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                )}
                <button
                    onClick={onCopy}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Copy ${label}`}
                >
                    {copied ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                        <Copy className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    iconBg,
    valueClass,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    iconBg: string;
    valueClass?: string;
}) {
    return (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={cn("p-2.5 rounded-lg shrink-0", iconBg)}>{icon}</div>
            <div>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className={cn("text-xl font-bold text-foreground", valueClass)}>
                    {value}
                </p>
            </div>
        </div>
    );
}
