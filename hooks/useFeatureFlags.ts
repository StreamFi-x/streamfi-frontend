import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export interface UseFeatureFlagsOptions {
  /**
   * If true, enables rapid polling and revalidation on focus for emergency kill-switches (#1714).
   * Reduces deduping interval to 3 seconds, enables refreshInterval (e.g. 5s), and revalidateOnFocus.
   */
  isKillSwitch?: boolean;
  refreshInterval?: number;
}

/**
 * Returns resolved feature flag states for the current user.
 * Pass specific keys to avoid fetching all flags.
 *
 * @example
 * const { flags } = useFeatureFlags(["clips", "gifts"]);
 * if (flags.clips) { ... }
 *
 * // Fast path for emergency kill-switches (#1714)
 * const { flags } = useFeatureFlags(["killswitch_payments"], { isKillSwitch: true });
 */
export function useFeatureFlags(
  keys?: string[],
  options?: UseFeatureFlagsOptions
) {
  const isKillSwitch = options?.isKillSwitch ?? false;
  const query = keys?.length ? `?keys=${keys.join(",")}` : "";

  const { data, error, isLoading } = useSWR<{ flags: Record<string, boolean> }>(
    `/api/feature-flags${query}`,
    fetcher,
    isKillSwitch
      ? {
          revalidateOnFocus: true,
          revalidateOnReconnect: true,
          dedupingInterval: 3_000,
          refreshInterval: options?.refreshInterval ?? 5_000,
        }
      : {
          revalidateOnFocus: false,
          dedupingInterval: 60_000,
        }
  );

  return {
    flags: data?.flags ?? {},
    isLoading,
    error,
  };
}

/**
 * Dedicated fast-path hook for emergency kill-switch flags (#1714).
 */
export function useKillSwitch(keys?: string[], refreshInterval = 5_000) {
  return useFeatureFlags(keys, { isKillSwitch: true, refreshInterval });
}
