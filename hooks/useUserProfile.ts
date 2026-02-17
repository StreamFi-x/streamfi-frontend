import useSWR from "swr";
import { User } from "@/types/user";

const fetcher = async ([url, wallet]: [
  string,
  string,
]): Promise<User | null> => {
  const res = await fetch(url, {
    headers: {
      "x-wallet-address": wallet,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    throw new Error("Failed to fetch user profile");
  }

  const data = await res.json();
  return data.user;
};

export function useUserProfile(wallet: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<User | null>(
    wallet ? ([`/api/users/wallet/${wallet}`, wallet] as const) : null,
    fetcher,
    {
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: true, // Refetch on network reconnect
      dedupingInterval: 10000, // Prevent duplicate requests within 10 seconds
      shouldRetryOnError: false, // Don't retry on error (user might not exist)
      // Cache for 5 minutes
      refreshInterval: 5 * 60 * 1000,
    }
  );

  return {
    user: data,
    isLoading,
    isError: error,
    mutate, // Allow manual refresh
  };
}
