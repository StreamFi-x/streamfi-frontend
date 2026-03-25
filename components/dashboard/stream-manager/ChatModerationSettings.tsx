"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  X,
  Ban,
  Clock,
  Users,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import type { ChatBan, StreamChatSettings } from "@/types/chat";

export default function ChatModerationSettings() {
  const { publicKey, privyWallet } = useStellarWallet();
  const walletAddress = publicKey || privyWallet?.wallet || null;
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [bans, setBans] = useState<ChatBan[]>([]);
  const [settings, setSettings] = useState<StreamChatSettings>({
    slowModeSeconds: 0,
    followerOnlyChat: false,
    linkBlocking: false,
  });

  // Load settings and bans
  useEffect(() => {
    if (!walletAddress) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const [settingsRes, bansRes] = await Promise.all([
          fetch(`/api/streams/settings?wallet=${walletAddress}`),
          fetch(`/api/streams/chat/ban?streamOwnerWallet=${walletAddress}`),
        ]);

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSettings(data.settings);
        }

        if (bansRes.ok) {
          const data = await bansRes.json();
          setBans(data.bans);
        }
      } catch (error) {
        console.error("Failed to load moderation data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [walletAddress]);

  const updateSetting = async (
    key: keyof StreamChatSettings,
    value: number | boolean
  ) => {
    if (!walletAddress) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/streams/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          [key]: value,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to update setting:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const unbanUser = async (username: string) => {
    if (!walletAddress) return;

    try {
      const res = await fetch(
        `/api/streams/chat/ban/${username}?streamOwnerWallet=${walletAddress}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setBans(prev => prev.filter(ban => ban.bannedUser !== username));
      }
    } catch (error) {
      console.error("Failed to unban user:", error);
    }
  };

  if (isMinimized) {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <Shield className="w-4 h-4" />
          <span>Show Chat Moderation</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Chat Moderation
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 hover:bg-muted rounded-md transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !walletAddress ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No wallet connected
          </p>
        ) : (
          <>
            {/* Slow Mode */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <label className="text-xs font-semibold text-foreground">
                  Slow Mode
                </label>
              </div>
              <select
                value={settings.slowModeSeconds}
                onChange={e =>
                  updateSetting("slowModeSeconds", parseInt(e.target.value))
                }
                disabled={isSaving}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-highlight disabled:opacity-50"
              >
                <option value={0}>Off</option>
                <option value={3}>3 seconds</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
              </select>
            </div>

            {/* Follower-only Chat */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">
                    Follower-only chat
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.followerOnlyChat}
                  onChange={e =>
                    updateSetting("followerOnlyChat", e.target.checked)
                  }
                  disabled={isSaving}
                  className="w-4 h-4 rounded border-border bg-secondary text-highlight focus:ring-1 focus:ring-highlight disabled:opacity-50"
                />
              </label>
            </div>

            {/* Link Blocking */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">
                    Block links
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.linkBlocking}
                  onChange={e =>
                    updateSetting("linkBlocking", e.target.checked)
                  }
                  disabled={isSaving}
                  className="w-4 h-4 rounded border-border bg-secondary text-highlight focus:ring-1 focus:ring-highlight disabled:opacity-50"
                />
              </label>
            </div>

            {/* Active Bans */}
            {bans.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Ban className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">
                    Active Bans ({bans.length})
                  </span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {bans.map(ban => (
                    <div
                      key={ban.id}
                      className="flex items-center justify-between bg-secondary border border-border rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {ban.bannedUser}
                        </p>
                        {ban.expiresAt && (
                          <p className="text-[10px] text-muted-foreground">
                            Timeout expires:{" "}
                            {new Date(ban.expiresAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => unbanUser(ban.bannedUser)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Unban
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
