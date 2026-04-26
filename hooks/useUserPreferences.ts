import useSWR from "swr";
import { useCallback } from "react";

export interface UserPreferences {
  user_id: string;
  stream_quality: "auto" | "1080p" | "720p" | "480p" | "360p";
  notify_live: boolean;
  notify_clips: boolean;
  notify_tips: boolean;
  theme: "dark" | "light" | "system";
  language: string;
  chat_font_size: "small" | "medium" | "large";
  show_timestamps: boolean;
  updated_at: string;
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export function useUserPreferences() {
  const { data, error, isLoading, mutate } = useSWR<{ preferences: UserPreferences }>(
    "/api/users/preferences",
    fetcher,
    { revalidateOnFocus: false }
  );

  const update = useCallback(
    async (patch: Partial<Omit<UserPreferences, "user_id" | "updated_at">>) => {
      // Optimistic update
      if (data?.preferences) {
        mutate({ preferences: { ...data.preferences, ...patch } }, false);
      }
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        mutate(); // revert on failure
        throw new Error("Failed to update preferences");
      }
      const updated = await res.json();
      mutate({ preferences: updated.preferences }, false);
      return updated.preferences as UserPreferences;
    },
    [data, mutate]
  );

  return {
    preferences: data?.preferences ?? null,
    isLoading,
    error,
    update,
  };
}
