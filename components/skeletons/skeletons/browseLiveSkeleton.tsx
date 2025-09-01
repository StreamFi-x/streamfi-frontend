import { Skeleton } from "@/components/ui/skeleton";

interface BrowseLiveSkeletonProps {
  count?: number;
}

export function BrowseLiveSkeleton({ count = 12 }: BrowseLiveSkeletonProps) {
  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <LiveStreamCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function LiveStreamCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      {/* Stream thumbnail skeleton */}
      <div className="relative">
        <Skeleton className="w-full aspect-video rounded-t-lg" />

        {/* LIVE indicator - red badge in top-left */}
        <div className="absolute top-2 left-2">
          <Skeleton className="w-10 h-5 rounded-sm bg-red-500" />
        </div>

        {/* Viewer count - bottom-right */}
        <div className="absolute bottom-2 right-2">
          <Skeleton className="w-12 h-4 rounded-sm bg-black/60" />
        </div>
      </div>

      {/* Stream info section */}
      <div className="p-3">
        <div className="flex items-start space-x-3">
          {/* Streamer avatar */}
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />

          <div className="flex-1 min-w-0">
            {/* Stream title - 2 lines */}
            <Skeleton className="w-full h-4 mb-1 rounded-sm" />
            <Skeleton className="w-3/4 h-4 mb-2 rounded-sm" />

            {/* Streamer name */}
            <Skeleton className="w-1/2 h-3 mb-2 rounded-sm" />

            {/* Category tags */}
            <div className="flex space-x-1">
              <Skeleton className="w-12 h-3 rounded-sm" />
              <Skeleton className="w-16 h-3 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
