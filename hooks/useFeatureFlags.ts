import useSWR from "swr";

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

/**
 * Returns resolved feature flag states for the current user.
 * Pass specific keys to avoid fetching all flags.
 *
 * @example
 * const { flags } = useFeatureFlags(["clips", "gifts"]);
 * if (flags.clips) { ... }
 */
export function useFeatureFlags(keys?: string[]) {
  const query = keys?.length ? `?keys=${keys.join(",")}` : "";
  const { data, error, isLoading } = useSWR<{ flags: Record<string, boolean> }>(
    `/api/feature-flags${query}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    flags: data?.flags ?? {},
    isLoading,
    error,
  };
}
