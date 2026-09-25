'use client';

import { useRecommendations, type Recommendation } from '@/hooks/useRecommendations';
import { useAuth } from '@/components/auth/auth-provider';
import Image from 'next/image';
import Link from 'next/link';
import { getDefaultAvatar } from '@/lib/profile-icons';
import { ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

interface ContinueWatchingProps {
  limit?: number;
  showTitle?: boolean;
  className?: string;
}

/**
 * Continue Watching component — displays resumable streams from watch history
 * Shows VODs/clips the user hasn't finished, with resume position
 */
export function ContinueWatching({
  limit = 5,
  showTitle = true,
  className = '',
}: ContinueWatchingProps) {
  const { user } = useAuth();
  const { continueWatching, isLoading } = useRecommendations({
    continueWatchingLimit: limit,
    enabled: !!user,
  });

  if (!user) return null;
  if (isLoading) return <ContinueWatchingSkeleton count={limit} />;
  if (continueWatching.length === 0) return null;

  return (
    <div className={clsx('w-full', className)}>
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Continue Watching</h2>
          <Link
            href="/watch-history"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {continueWatching.map((item) => (
          <ContinueWatchingCard key={`${item.stream_type}-${item.stream_id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual continue watching card with resume progress and creator info
 */
function ContinueWatchingCard({ item }: { item: Recommendation }) {
  const watchProgressPercent = Math.min(100, Math.ceil((item.watch_seconds / 3600) * 100)); // Rough estimate

  return (
    <Link
      href={`/${item.streamer_username}/watch?stream_id=${item.stream_id}`}
      className="group relative overflow-hidden rounded-lg bg-surface hover:bg-surface/80 transition-colors duration-200 cursor-pointer"
    >
      {/* Thumbnail placeholder with overlay */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
          <span className="text-xs font-medium text-white bg-black/60 px-2 py-1 rounded">
            {item.stream_type === 'vod' ? 'VOD' : 'CLIP'}
          </span>
        </div>
        {/* Watch progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div
            className="h-full bg-highlight transition-all duration-300 group-hover:bg-highlight/90"
            style={{ width: `${watchProgressPercent}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-highlight transition-colors">
          {item.stream_title || `${item.stream_type === 'vod' ? 'VOD' : 'Clip'}`}
        </h3>

        {/* Creator info */}
        <div className="flex items-center gap-2">
          <Image
            src={item.streamer_avatar || getDefaultAvatar(item.streamer_username)}
            alt={item.streamer_username}
            width={20}
            height={20}
            className="w-5 h-5 rounded-full object-cover"
          />
          <span className="text-xs text-muted-foreground truncate">
            {item.streamer_username}
          </span>
        </div>

        {/* Watched time */}
        <p className="text-xs text-muted-foreground">
          Watched {formatDistanceToNow(new Date(item.last_watched_at), { addSuffix: true })}
        </p>
      </div>
    </Link>
  );
}

/**
 * Skeleton loader for continue watching section
 */
function ContinueWatchingSkeleton({ count = 5 }: { count: number }) {
  return (
    <div className="w-full">
      <div className="mb-4 h-6 w-40 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-lg bg-surface overflow-hidden">
            <div className="aspect-video bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
