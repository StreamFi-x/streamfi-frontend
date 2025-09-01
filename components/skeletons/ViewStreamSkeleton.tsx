import { Skeleton } from "@/components/ui/skeleton";

export function ViewStreamSkeleton() {
  return (
    <div className="bg-background text-foreground border border-border flex flex-col h-full bg-[#17191A]">
      <div className="flex flex-1 items-start relative overflow-hidden">
        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-hide">
          {/* Video player skeleton */}
          <div className="relative bg-black aspect-video">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-center">
                <Skeleton className="w-20 h-6 bg-red-600 mb-4" />
                <Skeleton className="w-32 h-6 bg-gray-700" />
              </div>
            </div>
          </div>

          {/* Stream info skeleton */}
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Skeleton className="w-12 h-12 rounded-full bg-gray-700" />
                <div className="space-y-2">
                  <Skeleton className="w-32 h-5 bg-gray-700" />
                  <Skeleton className="w-48 h-4 bg-gray-700" />
                  <div className="flex gap-2">
                    <Skeleton className="w-16 h-4 bg-gray-700 rounded" />
                    <Skeleton className="w-20 h-4 bg-gray-700 rounded" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="w-24 h-9 bg-gray-700 rounded" />
                  <Skeleton className="w-20 h-9 bg-gray-700 rounded" />
                  <Skeleton className="w-9 h-9 bg-gray-700 rounded" />
                </div>
                <Skeleton className="w-32 h-4 bg-gray-700" />
              </div>
            </div>
          </div>

          {/* About section skeleton */}
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="w-32 h-5 bg-gray-700" />
              <div className="flex space-x-4">
                <Skeleton className="w-16 h-4 bg-gray-700" />
                <Skeleton className="w-16 h-4 bg-gray-700" />
                <Skeleton className="w-16 h-4 bg-gray-700" />
              </div>
            </div>
            <Skeleton className="w-full h-4 bg-gray-700 mb-2" />
            <Skeleton className="w-3/4 h-4 bg-gray-700" />
          </div>

          {/* Past streams skeleton */}
          <div className="p-4">
            <Skeleton className="w-32 h-6 bg-gray-700 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video bg-gray-700 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="w-3/4 h-4 bg-gray-700" />
                    <Skeleton className="w-1/2 h-3 bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat sidebar skeleton */}
        <div className="w-[30%] border-l border-gray-800">
          <div className="p-4 space-y-4">
            <Skeleton className="w-32 h-6 bg-gray-700" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="w-8 h-8 rounded-full bg-gray-700" />
                  <Skeleton className="w-20 h-4 bg-gray-700" />
                </div>
                <Skeleton className="w-full h-4 bg-gray-700 ml-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
