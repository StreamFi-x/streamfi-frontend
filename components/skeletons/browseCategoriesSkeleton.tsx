import { Skeleton } from "@/components/ui/skeleton";

interface BrowseCategoriesSkeletonProps {
  count?: number;
}

export function BrowseCategoriesSkeleton({
  count = 10,
}: BrowseCategoriesSkeletonProps) {
  return (
    <div className="mb-8 space-y-4">
      {/* Long list of tags below "Browse" */}
      <div className="flex overflow-x-auto lg:flex-wrap lg:overflow-x-visible scrollbar-hide gap-3">
        <Skeleton className="w-20 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-32 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-22 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-18 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-24 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-22 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-16 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-24 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-32 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-19 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-28 h-8 rounded-md px-8 py-6" />
        <Skeleton className="w-21 h-8 rounded-md px-8 py-6" />
      </div>

      {/* Section to switch between live channels and categories */}
      <div className="flex space-x-8 border-b border-gray-700">
        <Skeleton className="w-28 h-8 rounded-md mb-0.5" />
        <Skeleton className="w-24 h-8 rounded-md" />
      </div>

      {/* Search bar and sort by section */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch md:items-center p-4 md:p-6 rounded-lg">
        {/* Search bar on the left */}
        <div className="w-full md:flex-1 md:max-w-xl">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Sort by dropdown on the right */}
        <div className="w-full md:w-auto md:ml-auto">
          <Skeleton className="h-9 w-full md:w-64 rounded-md" />
        </div>
      </div>

      {/* Category cards grid*/}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <CategoryCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function CategoryCardSkeleton() {
  return (
    <div className="bg-gray-800 dark:bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer">
      {/* Game artwork/thumbnail - SQUARISH proportions as they appear on your screen */}
      <div className="relative">
        <Skeleton className="w-full aspect-square rounded-t-lg bg-gray-600 dark:bg-gray-700" />
      </div>

      {/* Card content */}
      <div className="p-3 space-y-2">
        {/* Game title */}
        <Skeleton className="w-3/4 h-4 bg-gray-600 dark:bg-gray-700 rounded-sm" />

        {/* Viewer count */}
        <Skeleton className="w-20 h-3 bg-gray-600 dark:bg-gray-700 rounded-sm" />

        {/* Category tags */}
        <div className="flex flex-wrap gap-1">
          <Skeleton className="w-8 h-3 rounded-sm bg-gray-600 dark:bg-gray-700" />
          <Skeleton className="w-12 h-3 rounded-sm bg-gray-600 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}
