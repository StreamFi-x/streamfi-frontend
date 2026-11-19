"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Coins, Activity, RefreshCw } from "lucide-react";
import type {
  Breadcrumb,
  EnvironmentSnapshot,
} from "@/lib/session-replay/types";

/**
 * Admin review of session replay reconstructions (#1750): the breadcrumb
 * trail of what a user clicked and what the wallet/tipping flow did right
 * before a client-side error, plus the wallet-extension environment.
 */

interface ReplayRow {
  id: string;
  flow: "wallet" | "tipping" | "general";
  error_message: string;
  error_stack: string | null;
  error_details: Record<string, unknown> | null;
  breadcrumbs: Breadcrumb[];
  environment: EnvironmentSnapshot;
  created_at: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Unable to load session replays");
  }
  return res.json();
};

const FLOWS = ["all", "wallet", "tipping", "general"] as const;

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-blue-500",
  debug: "bg-muted-foreground",
  warning: "bg-yellow-500",
  error: "bg-red-500",
};

function FlowIcon({ flow }: { flow: ReplayRow["flow"] }) {
  if (flow === "wallet") {
    return <Wallet size={14} />;
  }
  if (flow === "tipping") {
    return <Coins size={14} />;
  }
  return <Activity size={14} />;
}

function formatOffset(ms: number) {
  const s = Math.round(ms / 100) / 10;
  return s === 0 ? "0s" : `-${s}s`;
}

function ReplayDetail({
  replay,
  onClose,
}: {
  replay: ReplayRow;
  onClose: () => void;
}) {
  const crumbs = Array.isArray(replay.breadcrumbs) ? replay.breadcrumbs : [];
  const errorTime = crumbs.length
    ? crumbs[crumbs.length - 1].timestamp
    : new Date(replay.created_at).getTime();
  const env = replay.environment;
  const extensions = env?.walletExtensions
    ? Object.entries(env.walletExtensions)
        .filter(([, present]) => present)
        .map(([key]) => key.replace(/^has/, ""))
    : [];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-sidebar rounded-xl border border-border p-6 w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Session replay
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              {replay.id}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close replay"
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-lg border border-red-800/40 bg-red-900/20 p-3 mb-5">
          <p className="text-sm font-medium text-red-400">
            {replay.error_message}
          </p>
          {replay.error_details && (
            <pre className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
              {JSON.stringify(replay.error_details, null, 2)}
            </pre>
          )}
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-2">
          Environment
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs mb-5">
          <div>
            <dt className="text-muted-foreground">Page</dt>
            <dd className="text-foreground break-all">{env?.pathname ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Wallet extensions detected</dt>
            <dd className="text-foreground">
              {extensions.length ? extensions.join(", ") : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Wallet state</dt>
            <dd className="text-foreground">
              {env?.walletState?.isConnected
                ? `Connected (${env.walletState.lastWalletId ?? "unknown"}, ${env.walletState.addressMasked})`
                : "Not connected"}
              {env?.walletState?.hasPrivy ? " · Privy session" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Network</dt>
            <dd className="text-foreground">
              {env?.networkState?.online ? "Online" : "Offline"}
              {env?.networkState?.effectiveType
                ? ` (${env.networkState.effectiveType})`
                : ""}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">User agent</dt>
            <dd className="text-foreground break-all">{env?.userAgent ?? "—"}</dd>
          </div>
        </dl>

        <h3 className="text-sm font-semibold text-foreground mb-3">
          Actions before the error ({crumbs.length})
        </h3>
        <ol className="relative border-l border-border ml-2 space-y-3">
          {crumbs.map(crumb => (
            <li key={crumb.id} className="ml-4">
              <span
                className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${LEVEL_STYLES[crumb.level] ?? LEVEL_STYLES.info}`}
              />
              <div className="flex items-baseline gap-2 text-xs">
                <span className="font-mono text-muted-foreground w-14 shrink-0">
                  {formatOffset(errorTime - crumb.timestamp)}
                </span>
                <span className="uppercase tracking-wide text-[10px] text-muted-foreground">
                  {crumb.category}
                </span>
              </div>
              <p className="text-sm text-foreground ml-16">{crumb.message}</p>
              {crumb.data && Object.keys(crumb.data).length > 0 && (
                <pre className="ml-16 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
                  {JSON.stringify(crumb.data)}
                </pre>
              )}
            </li>
          ))}
        </ol>

        {replay.error_stack && (
          <details className="mt-5">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Stack trace
            </summary>
            <pre className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
              {replay.error_stack}
            </pre>
          </details>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function AdminReplaysPage() {
  const [flow, setFlow] = useState<(typeof FLOWS)[number]>("all");
  const [selected, setSelected] = useState<ReplayRow | null>(null);
  const { data, error, isLoading, mutate } = useSWR<{ replays: ReplayRow[] }>(
    `/api/admin/replays?flow=${flow}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const replays = data?.replays ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Session Replays</h1>
        <button
          onClick={() => void mutate()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-foreground hover:bg-surface-hover"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {FLOWS.map(f => (
          <button
            key={f}
            onClick={() => setFlow(f)}
            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
              flow === f
                ? "bg-highlight text-background"
                : "bg-sidebar border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-500">
          {error.message}
        </p>
      )}

      <div className="bg-sidebar rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="px-4 py-3 font-medium">Flow</th>
              <th className="px-4 py-3 font-medium">Error</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">
                Actions
              </th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {replays.map(r => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="border-b border-border hover:bg-surface-hover cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 capitalize text-foreground">
                    <FlowIcon flow={r.flow} /> {r.flow}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground max-w-md truncate">
                  {r.error_message}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                  {Array.isArray(r.breadcrumbs) ? r.breadcrumbs.length : 0}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && replays.length === 0 && !error && (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No session replays recorded.
          </div>
        )}
        {isLoading && (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Loading…
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <ReplayDetail replay={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
