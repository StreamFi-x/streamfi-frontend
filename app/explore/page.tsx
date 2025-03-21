import { FeaturedStream } from "@/components/explore/home/FeaturedStream";
import { LiveStreams } from "@/components/explore/home/LiveStreams";
import { TrendingStreams } from "@/components/explore/home/TrendingStreams";
import { featuredStream } from "@/data/explore/home/featured-stream";
import { liveStreams } from "@/data/explore/home/live-streams";
import { trendingStreams } from "@/data/explore/home/trending-streams";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto px-4 py-8">
        <FeaturedStream stream={featuredStream} />

        <LiveStreams
          title="Live on Streamfi"
          category="gaming"
          streams={liveStreams}
        />

        <TrendingStreams title="Trending in Gaming" streams={trendingStreams} />
      </main>
    </div>
  );
}
