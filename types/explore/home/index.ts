export interface CarouselStream {
  id: string;
  title: string;
  thumbnail: string;
  playbackId?: string;
  viewCount: string;
  isLive: boolean;
  streamer: {
    name: string;
    username: string;
    logo: string;
  };
  tags: string[];
  location: string;
}

export interface FeaturedStreamProps {
  streams: CarouselStream[];
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
