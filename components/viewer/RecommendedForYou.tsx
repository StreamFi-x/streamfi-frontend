'use client';

import { useRecommendations, type Recommendation } from '@/hooks/useRecommendations';
import { useAuth } from '@/components/auth/auth-provider';
import Image from 'next/image';
import Link from 'next/link';
import { getDefaultAvatar } from '@/lib/profile-icons';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

interface RecommendedForYouProps {
  limit?: number;
  showTitle?: boolean;
  className?: string;
}

/**
 * Recommended For You component — displays streams from creators user has watched
 * Provides personalized discovery based on viewing history
 */
export function RecommendedForYou({
  limit = 8,
  showTitle = true,
  className = '',
}: RecommendedForYouProps) {
  const { user } = useAuth();
  const { recommended, isLoading } = useRecommendations({
    limit,
    enabled: !!user,
  });

  if (!user) return null;
  if (isLoading) return <RecommendedSkeleton count={limit} />;
  if (recommended.length === 0) return null;

  return (
    <div className={clsx('w-full', className)}>
      {showTitle && (
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Recommended For You
        </h2>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {recommended.map((item) => (
          <RecommendedCard key={`${item.stream_type}-${item.stream_id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual recommended stream card
 */
function RecommendedCard({ item }: { item: Recommendation }) {
  return (
    <Link
      href={`/${item.streamer_username}`}
      className="group relative overflow-hidden rounded-lg bg-surface hover:bg-surface/80 transition-colors duration-200 cursor-pointer"
    >
      {/* Thumbnail placeholder */}
      <div className="relative aspect-video bg-gradient-to-br from-muted to-muted-foreground/20 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col items-end justify-end p-3">
          <span className="text-xs font-medium text-white bg-black/60 px-2 py-1 rounded">
            {item.stream_type === 'vod' ? 'VOD' : 'LIVE'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-highlight transition-colors">
          {item.stream_title || 'Untitled Stream'}
        </h3>

        {/* Creator info */}
        <div className="flex items-center gap-2">
          <Image
            src={item.streamer_avatar || getDefaultAvatar(item.streamer_username)}
            alt={item.streamer_username}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {item.streamer_username}
            </p>
            <p className="text-xs text-muted-foreground">
              Watched {formatDistanceToNow(new Date(item.last_watched_at))} ago
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Skeleton loader for recommended section
 */
function RecommendedSkeleton({ count = 8 }: { count: number }) {
  return (
    <div className="w-full">
      <div className="mb-4 h-6 w-48 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-lg bg-surface overflow-hidden">
            <div className="aspect-video bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-muted rounded-full animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded animate-pulse" />
                  <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
