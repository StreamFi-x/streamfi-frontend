import { useEffect, useState } from 'react';
import useSWR from 'swr';

export interface Recommendation {
  stream_id: string | null;
  stream_type: string;
  stream_title: string;
  streamer_username: string;
  streamer_avatar: string | null;
  streamer_id: string;
  last_watched_at: string;
  watch_seconds: number;
  reason: 'continue_watching' | 'recommended';
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  continue_watching_count: number;
  recommended_count: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch recommendations');
  return res.json() as Promise<RecommendationsResponse>;
};

interface UseRecommendationsOptions {
  limit?: number;
  continueWatchingLimit?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch personalized recommendations and continue watching items
 */
export function useRecommendations(options: UseRecommendationsOptions = {}) {
  const {
    limit = 20,
    continueWatchingLimit = 5,
    enabled = true,
  } = options;

  const url = enabled
    ? `/api/routes-f/recommendations?limit=${limit}&continue_limit=${continueWatchingLimit}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 1 minute dedup interval
  });

  return {
    recommendations: data?.recommendations ?? [],
    continueWatching: data?.recommendations.filter((r) => r.reason === 'continue_watching') ?? [],
    recommended: data?.recommendations.filter((r) => r.reason === 'recommended') ?? [],
    isLoading,
    error,
    mutate,
  };
}
