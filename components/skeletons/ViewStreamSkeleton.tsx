import { Skeleton } from "@/components/ui/skeleton";

export function ViewStreamSkeleton() {
  return (
    <div className="bg-background text-foreground border border-border flex flex-col h-full min-h-0">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row relative overflow-hidden">
        {/* Main content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto scrollbar-hide">
          {/* Video player skeleton — matches actual player sizing */}
          <Skeleton className="w-full aspect-video min-h-[56vw] lg:min-h-[360px] rounded-none" />

          {/* Stream info skeleton */}
          <div className="border-b border-border p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              {/* Left: avatar + info */}
              <div className="flex items-start space-x-3 min-w-0">
                <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shrink-0" />
                <div className="space-y-2 min-w-0">
                  <Skeleton className="w-28 h-4" />
                  <Skeleton className="w-44 h-3" />
                  <div className="flex gap-1.5">
                    <Skeleton className="w-14 h-5 rounded" />
                    <Skeleton className="w-18 h-5 rounded" />
                    <Skeleton className="w-14 h-5 rounded" />
                  </div>
                </div>
              </div>
              {/* Right: action buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Skeleton className="w-20 h-8 rounded-md" />
                <Skeleton className="w-20 h-8 rounded-md" />
                <Skeleton className="w-8 h-8 rounded-md" />
                <Skeleton className="w-8 h-8 rounded-md" />
                <Skeleton className="w-14 h-4 rounded" />
              </div>
            </div>
          </div>

          {/* Report button row skeleton */}
          <div className="p-4 border-b border-border flex justify-end">
            <Skeleton className="w-36 h-8 rounded-md" />
          </div>

          {/* About section skeleton */}
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="w-28 h-5" />
              <div className="flex space-x-3">
                <Skeleton className="w-14 h-4" />
                <Skeleton className="w-14 h-4" />
              </div>
            </div>
            <Skeleton className="w-full h-3 mb-2" />
            <Skeleton className="w-5/6 h-3 mb-2" />
            <Skeleton className="w-3/4 h-3" />
          </div>

          {/* Past streams skeleton */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="w-28 h-5" />
              <Skeleton className="w-14 h-4" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-video w-full rounded-md" />
                  <Skeleton className="w-3/4 h-4" />
                  <Skeleton className="w-1/2 h-3" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat sidebar skeleton — desktop only, hidden on mobile & tablet */}
        <div className="hidden lg:flex flex-col w-[30%] border-l border-border">
          <div className="p-4 border-b border-border">
            <Skeleton className="w-24 h-5" />
          </div>
          <div className="flex-1 p-4 space-y-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-start space-x-2">
                <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="w-20 h-3" />
                  <Skeleton className="w-full h-3" />
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border">
            <Skeleton className="w-full h-9 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
