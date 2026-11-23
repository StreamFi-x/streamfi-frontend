import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

/**
 * Feature flag keys explicitly designated as emergency kill-switches
 * (#1714). These use a short poll/dedupe window instead of the default 60s
 * one, so flipping one off reaches already-open tabs within seconds rather
 * than waiting for a refocus or the next 60s revalidation. Only add a key
 * here when fast propagation to open sessions is operationally important —
 * every entry here means more frequent polling for that flag.
 */
export const KILL_SWITCH_FLAG_KEYS: ReadonlySet<string> = new Set([]);

const KILL_SWITCH_POLL_MS = 5_000;
const DEFAULT_DEDUPING_MS = 60_000;

/**
 * Returns resolved feature flag states for the current user.
 * Pass specific keys to avoid fetching all flags.
 *
 * If any requested key is in {@link KILL_SWITCH_FLAG_KEYS}, the whole request
 * switches to a short poll/dedupe window (#1714) — kill-switch flags are
 * expected to be requested on their own or grouped together, not mixed into
 * a large general flag fetch, since the faster window applies to the request
 * as a whole.
 *
 * @example
 * const { flags } = useFeatureFlags(["clips", "gifts"]);
 * if (flags.clips) { ... }
 */
export function useFeatureFlags(keys?: string[]) {
  const query = keys?.length ? `?keys=${keys.join(",")}` : "";
  const isKillSwitchRequest = keys?.some((key) => KILL_SWITCH_FLAG_KEYS.has(key)) ?? false;

  const { data, error, isLoading } = useSWR<{ flags: Record<string, boolean> }>(
    `/api/feature-flags${query}`,
    fetcher,
    isKillSwitchRequest
      ? {
          revalidateOnFocus: true,
          dedupingInterval: KILL_SWITCH_POLL_MS,
          refreshInterval: KILL_SWITCH_POLL_MS,
        }
      : { revalidateOnFocus: false, dedupingInterval: DEFAULT_DEDUPING_MS }
  );

  return {
    flags: data?.flags ?? {},
    isLoading,
    error,
  };
}
