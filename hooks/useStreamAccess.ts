"use client";

import useSWR from "swr";

export type StreamAccessResult =
  | { allowed: true; access_type: "public" | "paid" | "password" | "invite" }
  | {
      allowed: false;
      access_type: "paid";
      reason: "paid" | "wallet_required";
      price_usdc: string | null;
      streamer_id: string;
      streamer_public_key: string | null;
    }
  | {
      allowed: false;
      access_type: "password" | "invite";
      reason: "password" | "invite";
    };

async function fetcher(url: string, body: unknown): Promise<StreamAccessResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to check stream access");
  }
  return res.json();
}

export function useStreamAccess(params: {
  streamerUsername: string | null | undefined;
  viewerPublicKey: string | null | undefined;
  enabled?: boolean;
  pause?: boolean;
}) {
  const {
    streamerUsername,
    viewerPublicKey,
    enabled = true,
    pause = false,
  } = params;

  const key =
    enabled && !pause && streamerUsername
      ? [
          "/api/streams/access/check",
          { streamer_username: streamerUsername, viewer_public_key: viewerPublicKey ?? null },
        ]
      : null;

  const { data, error, isLoading, mutate } = useSWR<StreamAccessResult>(
    key,
    ([url, body]) => fetcher(url, body),
    { revalidateOnFocus: false }
  );

  return { access: data, error: error?.message ?? null, isLoading, refresh: mutate };
}

