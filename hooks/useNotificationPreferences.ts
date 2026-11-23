import { useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { NotificationPreferences } from "@/lib/notifications/preferences";

const ENDPOINT = "/api/routes-f/notification-preferences";
type PreferenceUpdates = Partial<
  Omit<NotificationPreferences, "user_id" | "updated_at">
>;

export function useNotificationPreferences(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<NotificationPreferences>(
    enabled ? ENDPOINT : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const update = useCallback(
    async (updates: PreferenceUpdates) => {
      const previous = data;
      if (previous) {
        void mutate({ ...previous, ...updates }, false);
      }

      try {
        const updated = await fetcher<NotificationPreferences>(ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        await mutate(updated, false);
        return updated;
      } catch (error) {
        if (previous) {
          await mutate(previous, false);
        }
        throw error;
      }
    },
    [data, mutate]
  );

  return {
    preferences: data ?? null,
    error,
    isLoading,
    update,
  };
}
