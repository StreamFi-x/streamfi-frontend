import { BrowseLiveSkeleton } from "./browseLiveSkeleton";
import { BrowseCategoriesSkeleton } from "./browseCategoriesSkeleton";

interface BrowsePageSkeletonProps {
  type: "live" | "categories";
  count?: number;
}

export function BrowsePageSkeleton({
  type,
  count = 12,
}: BrowsePageSkeletonProps) {
  return (
    <div className="space-y-8">
      {type === "live" ? (
        <BrowseLiveSkeleton count={count} />
      ) : (
        <BrowseCategoriesSkeleton count={count} />
      )}
    </div>
  );
}
