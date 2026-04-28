"use client";

import { useState } from "react";
import { X, UserPlus, Lock } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useStreamWhitelist } from "@/hooks/useStreamWhitelist";
import { getDefaultAvatar } from "@/lib/profile-icons";

/**
 * Streamer-side whitelist manager.
 * Lets the streamer add/remove users by username or wallet address.
 */
export function WhitelistManager() {
  const { whitelist, isLoading, add, remove, adding, removing } = useStreamWhitelist();
  const [input, setInput] = useState("");

  const handleAdd = async () => {
    const val = input.trim();
    if (!val) {
      return;
    }
    try {
      await add(val);
      setInput("");
      toast.success(`Added ${val} to whitelist`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    }
  };

  const handleRemove = async (identifier: string) => {
    try {
      await remove(identifier);
      toast.success("Removed from whitelist");
    } catch {
      toast.error("Failed to remove user");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="w-4 h-4" />
        <span>Only whitelisted users can watch this stream</span>
      </div>

      {/* Add input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="Username or wallet address"
          className="flex-1 bg-muted text-foreground text-sm px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-highlight"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-highlight text-white text-sm font-medium hover:bg-highlight/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          {adding ? "Adding…" : "Add"}
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : whitelist.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users whitelisted yet.</p>
      ) : (
        <ul className="space-y-2">
          {whitelist.map(entry => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 bg-muted rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Image
                  src={entry.avatar ?? getDefaultAvatar(entry.identifier)}
                  alt={entry.identifier}
                  width={28}
                  height={28}
                  className="rounded-full flex-shrink-0"
                />
                <span className="text-sm text-foreground truncate">
                  {entry.username ?? entry.identifier}
                </span>
              </div>
              <button
                onClick={() => handleRemove(entry.identifier)}
                disabled={removing === entry.identifier}
                aria-label={`Remove ${entry.identifier}`}
                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
