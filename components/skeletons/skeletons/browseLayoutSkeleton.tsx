import { Skeleton } from "@/components/ui/skeleton";

export function BrowseLayoutSkeleton() {
  return (
    <div className="mb-4 space-y-4">
      {/* Title skeleton */}
      <div className="mb-4">
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Primary Tag Filters skeleton */}
      <div className="mb-4 space-y-4 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {Array.from({ length: 11 }).map((_, index) => (
            <Skeleton key={index} className="w-20 h-8 rounded-md" />
          ))}
        </div>
      </div>

      {/* Tabs Navigation skeleton */}
      {/* <div className="mb-4">
        <div className="flex space-x-4 border-b border-gray-700">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="w-24 h-8 rounded-md mb-0.5" />
          ))}
        </div>
      </div> */}
    </div>
  );
}
