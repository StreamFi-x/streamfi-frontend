export interface Stream {
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
}

const locations = [
  "USA",
  "UK",
  "Canada",
  "Germany",
  "France",
  "Nigeria",
  "Brazil",
  "Japan",
];

const getRandomLocation = () =>
  locations[Math.floor(Math.random() * locations.length)];
const getRandomViewCount = () =>
  `${(Math.random() * (100 - 1) + 1).toFixed(1)}k`;

export const liveStreams: Stream[] = [
  {
    id: "1",
    title: "Clash of Clans Live play",
    thumbnail: "/images/explore/home/live-stream/img1.png?height=300&width=500",
    viewCount: getRandomViewCount(),
    streamer: {
      name: "JamesHG",
      logo: "/images/explore/home/live-stream/profile.png?height=50&width=50",
    },
    tags: ["Gameplay", "Strategy"],
    location: getRandomLocation(),
  },
  {
    id: "2",
    title: "Valorant Live play",
    thumbnail: "/images/explore/home/live-stream/img2.png?height=300&width=500",
    viewCount: getRandomViewCount(),
    streamer: {
      name: "NwanneSan",
      logo: "/images/explore/home/live-stream/profile.png?height=50&width=50",
    },
    tags: ["Gameplay", "Shooter"],
    location: getRandomLocation(),
  },
  {
    id: "3",
    title: "Fortnite Live play",
    thumbnail: "/images/explore/home/live-stream/img3.png?height=300&width=500",
    viewCount: getRandomViewCount(),
    streamer: {
      name: "DumtoZT",
      logo: "/images/explore/home/live-stream/profile.png?height=50&width=50",
    },
    tags: ["Gameplay", "Battle Royale"],
    location: getRandomLocation(),
  },
  {
    id: "4",
    title: "EAFC 2025 Live play",
    thumbnail: "/images/explore/home/live-stream/img4.png?height=300&width=500",
    viewCount: getRandomViewCount(),
    streamer: {
      name: "CijeDGamer",
      logo: "/images/explore/home/live-stream/profile.png?height=50&width=50",
    },
    tags: ["Gameplay", "Sports"],
    location: getRandomLocation(),
  },
  {
    id: "5",
    title: "PUBG Live play",
    thumbnail: "/images/explore/home/live-stream/img4.png?height=300&width=500",
    viewCount: getRandomViewCount(),
    streamer: {
      name: "RecksomGaming",
      logo: "/images/explore/home/live-stream/profile.png?height=50&width=50",
    },
    tags: ["Gameplay", "Survival"],
    location: getRandomLocation(),
  },
  {
    id: "6",
    title: "Counter-Strike Live play",
    thumbnail: "/images/explore/home/live-stream/img3.png?height=300&width=500",
    viewCount: getRandomViewCount(),
    streamer: {
      name: "Vladdddd",
      logo: "/images/explore/home/live-stream/profile.png?height=50&width=50",
    },
    tags: ["Gameplay", "Tactical Shooter"],
    location: getRandomLocation(),
  },
  {
    id: "7",
    title: "Call of Duty Live play",
    thumbnail: "/images/explore/home/live-stream/img2.png?height=300&width=500",
    viewCount: getRandomViewCount(),
    streamer: {
      name: "Flaxgames",
      logo: "/images/explore/home/live-stream/profile.png?height=50&width=50",
    },
    tags: ["Gameplay", "FPS"],
    location: getRandomLocation(),
  },
  {
    id: "8",
    title: "Forza Live play",
    thumbnail: "/images/explore/home/live-stream/img1.png?height=300&width=500",
    viewCount: getRandomViewCount(),
    streamer: {
      name: "Franklivania",
      logo: "/images/explore/home/live-stream/profile.png?height=50&width=50",
    },
    tags: ["Gameplay", "Racing"],
    location: getRandomLocation(),
  },
];
