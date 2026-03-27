import useSWR from "swr";

interface AdminAnalytics {
  totalUsers: number;
  liveNow: number;
  pendingStreamReports: number;
  pendingBugReports: number;
  newUsers7d: number;
  totalCategories: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch analytics");
  }
  return res.json();
};

export function useAdminAnalytics() {
  return useSWR<AdminAnalytics>("/api/admin/analytics", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });
}
