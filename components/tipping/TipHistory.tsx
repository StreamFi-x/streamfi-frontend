"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  ExternalLink,
  Copy,
  Loader2,
  DollarSign,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Inline helpers to avoid extra config files
const STELLAR_EXPERT_URL = "https://stellar.expert/explorer/testnet";

function getStellarExplorerUrl(txHash: string) {
  return `${STELLAR_EXPERT_URL}/tx/${txHash}`;
}

function truncateAddress(address: string) {
  if (!address) {return "";}
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

interface TipRecord {
  id: string;
  sender: string;
  senderUsername?: string;
  amount: string;
  asset: string;
  txHash: string;
  timestamp: string;
}

interface TipHistoryProps {
  username: string;
}

export function TipHistory({ username }: TipHistoryProps) {
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalReceived, setTotalReceived] = useState<string>("0");
  const [totalCount, setTotalCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTipHistory(cursor?: string) {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/tips/${username}${cursor ? `?cursor=${cursor}` : ""}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setTips(prev => (cursor ? [...prev, ...data.tips] : data.tips));
        setNextCursor(data.pagination.nextCursor);
        setTotalReceived(data.total.received);
        setTotalCount(data.total.count);
      } else {
        throw new Error("Failed to fetch tip history");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (username) {
      fetchTipHistory();
    }
  }, [username]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/tips/refresh-total", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {throw new Error("Refresh failed");}

      toast.success("Tip totals refreshed!");
      await fetchTipHistory();
    } catch (err) {
      console.error(err);
      toast.error("Failed to refresh stats");
    } finally {
      setRefreshing(false);
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const loadMore = () => {
    if (nextCursor) {fetchTipHistory(nextCursor);}
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Total Received</p>
            <p className="text-2xl font-bold">{totalReceived} XLM</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
            <History size={24} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Tip Count</p>
            <p className="text-2xl font-bold">{totalCount}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
              <RefreshCw size={24} className={refreshing ? "animate-spin" : ""} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Last Refresh</p>
              <p className="text-xs text-muted-foreground font-medium text-green-500">Updated live</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-lg">Transaction History</h3>
        </div>

        <div className="overflow-x-auto">
          {tips.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-6 py-4">Sender</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tips.map(tip => (
                  <tr key={tip.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{tip.senderUsername || "Anonymous"}</span>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{truncateAddress(tip.sender)}</span>
                          <button onClick={() => copyToClipboard(tip.sender, "Address")} className="hover:text-foreground">
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span>{tip.amount}</span>
                        <span className="text-xs text-muted-foreground font-normal">{tip.asset}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(tip.timestamp), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => copyToClipboard(tip.txHash, "Tx Hash")} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
                          <Copy size={16} />
                        </button>
                        <a href={getStellarExplorerUrl(tip.txHash)} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : !loading && (
            <div className="p-12 text-center text-muted-foreground">
              {error ? (
                <div>
                  <p className="text-destructive mb-4">{error}</p>
                  <Button variant="outline" onClick={() => fetchTipHistory()}>Retry</Button>
                </div>
              ) : (
                <p>No tips found. Share your profile link!</p>
              )}
            </div>
          )}
        </div>

        {(loading || nextCursor) && (
          <div className="p-4 bg-muted/10 flex justify-center border-t border-border">
            {loading ? (
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            ) : (
              <Button variant="ghost" size="sm" onClick={loadMore}>Load More History</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
