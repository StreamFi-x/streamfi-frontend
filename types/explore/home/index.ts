export interface FeaturedStreamProps {
  stream: {
    title: string;
    thumbnail: string;
    isLive: boolean;
    streamerThumbnail?: string;
  };
}
export interface LiveStreamProps {
  title: string;
  category: string;
  streams: Array<{
    id: string;
    title: string;
    thumbnail: string;
    viewCount: string;
    streamer: {
      name: string;
      logo: string;
    };
    tags: string[];
    location: string;
  }>;
}
export interface TrendingStreamsProps {
  title: string;
  streams: Array<{
    id: string;
    title: string;
    thumbnail: string;
    viewCount: string;
    streamer: {
      name: string;
      logo: string;
    };
    tags: string[];
    location: string;
  }>;
}
