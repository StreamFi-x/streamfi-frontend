import useSWR from "swr";

export interface AdminFeatureFlag {
  key: string;
  description: string | null;
  enabled: boolean;
  rollout_percentage: number;
  allowed_user_ids: string[];
  updated_at?: string;
}

interface FeatureFlagsResponse {
  flags: AdminFeatureFlag[];
}

const fetcher = async (url: string): Promise<FeatureFlagsResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch feature flags");
  }
  return res.json();
};

export function useAdminFeatureFlags() {
  return useSWR<FeatureFlagsResponse>("/api/admin/feature-flags", fetcher, {
    revalidateOnFocus: false,
  });
}
