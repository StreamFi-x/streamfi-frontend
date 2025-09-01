import { Skeleton } from "@/components/ui/skeleton";

interface BrowseCategoriesSkeletonProps {
  count?: number;
}

export function BrowseCategoriesSkeleton({
  count = 10,
}: BrowseCategoriesSkeletonProps) {
  return (
    <div className="my-8 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {Array.from({ length: count }).map((_, index) => (
          <div
            className=" rounded-lg overflow-hidden hover: transition-colors cursor-pointer"
            key={index}
          >
            {/* Game artwork/thumbnail */}
            <div className="relative">
              <Skeleton className="w-full aspect-square rounded-t-lg " />
            </div>
            <div className="p-3 space-y-2">
              {/* Game title */}
              <Skeleton className="w-3/4 h-4  rounded-sm" />
              {/* Viewer count */}
              <Skeleton className="w-20 h-3  rounded-sm" />
              {/* Category tags */}
              <div className="flex flex-wrap gap-1">
                <Skeleton className="w-8 h-3 rounded-sm " />
                <Skeleton className="w-12 h-3 rounded-sm " />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
