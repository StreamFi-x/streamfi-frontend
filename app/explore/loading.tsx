export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <main className="container mx-auto px-4 py-8 animate-pulse">
        {/* Featured stream skeleton */}
        <div className="w-full aspect-[16/6] bg-card rounded-xl mb-8" />

        {/* Live section */}
        <div className="w-full py-6">
          <div className="h-7 bg-muted rounded w-40 mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card p-2 pb-4 rounded-lg">
                <div className="relative rounded-lg overflow-hidden">
                  <div className="w-full aspect-video bg-muted rounded-lg" />
                  <div className="absolute top-2 left-2 h-5 w-9 bg-muted/60 rounded" />
                  <div className="absolute top-2 right-2 h-5 w-14 bg-muted/60 rounded" />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                    <div className="h-3 bg-muted rounded w-20" />
                  </div>
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="flex gap-2 mt-1">
                    <div className="h-5 bg-muted rounded w-16" />
                    <div className="h-5 bg-muted rounded w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trending section */}
        <div className="w-full py-6">
          <div className="h-7 bg-muted rounded w-48 mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card p-2 pb-4 rounded-lg">
                <div className="w-full aspect-video bg-muted rounded-lg" />
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                    <div className="h-3 bg-muted rounded w-20" />
                  </div>
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Past streams section */}
        <div className="mt-10">
          <div className="h-7 bg-muted rounded w-36 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg overflow-hidden">
                <div className="aspect-video bg-muted" />
                <div className="p-3 flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
