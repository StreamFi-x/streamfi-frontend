import useSWR from "swr";
import { useCallback, useState } from "react";

export interface WhitelistEntry {
  id: string;
  identifier: string;
  username: string | null;
  avatar: string | null;
  created_at: string;
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

/** Streamer-side: manage their whitelist */
export function useStreamWhitelist() {
  const { data, error, isLoading, mutate } = useSWR<{ whitelist: WhitelistEntry[] }>(
    "/api/streams/whitelist",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const add = useCallback(
    async (identifier: string) => {
      setAdding(true);
      try {
        const res = await fetch("/api/streams/whitelist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ identifier }),
        });
        if (!res.ok) {
          const { error: msg } = await res.json();
          throw new Error(msg ?? "Failed to add");
        }
        await mutate();
      } finally {
        setAdding(false);
      }
    },
    [mutate]
  );

  const remove = useCallback(
    async (identifier: string) => {
      setRemoving(identifier);
      try {
        const res = await fetch("/api/streams/whitelist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ identifier }),
        });
        if (!res.ok) {
          throw new Error("Failed to remove");
        }
        mutate(
          prev => prev
            ? { whitelist: prev.whitelist.filter(e => e.identifier !== identifier) }
            : prev,
          false
        );
      } finally {
        setRemoving(null);
      }
    },
    [mutate]
  );

  return {
    whitelist: data?.whitelist ?? [],
    isLoading,
    error,
    add,
    remove,
    adding,
    removing,
  };
}

/** Viewer-side: check if they have access to a private stream */
export function useWhitelistAccess(streamerUsername: string | null) {
  const { data, isLoading } = useSWR<{ allowed: boolean }>(
    streamerUsername ? `/api/streams/whitelist?streamer=${encodeURIComponent(streamerUsername)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return { allowed: data?.allowed ?? false, isLoading };
}
