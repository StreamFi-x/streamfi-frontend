export interface VideoCard {
  id: string;
  title: string;
  thumbnailUrl: string;
  username: string;
  category: string;
  tags: string[];
  viewCount: number;
  isLive: boolean;
  language: string;
  duration?: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export const liveTags = [
  "Games",
  "IRL",
  "Shooter",
  "RPG",
  "Strategy",
  "Racing",
  "Sports",
  "Music",
  "Art",
  "Cooking",
  "Travel",
  "Tech",
  "Education",
  "Entertainment",
  "News",
  "Politics",
  "Science",
  "Health",
  "Fitness",
  "Gaming"
];

export const languageOptions: FilterOption[] = [
  { value: "all", label: "All Languages" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" }
];

export const sortOptions: FilterOption[] = [
  { value: "viewers", label: "Most Viewers" },
  { value: "recent", label: "Recently Started" },
  { value: "popular", label: "Most Popular" },
  { value: "trending", label: "Trending" }
];

export const liveVideos: VideoCard[] = [
  {
    id: "1",
    title: "Clash of clans Live play",
    thumbnailUrl: "/Images/clash.png",
    username: "Flaxgames",
    category: "Games",
    tags: ["Nigerian", "Gameplay"],
    viewCount: 14500,
    isLive: true,
    language: "en"
  },
  {
    id: "2",
    title: "FORTNITE",
    thumbnailUrl: "/Images/fortnite.png",
    username: "ProGamer",
    category: "Games",
    tags: ["FPS", "Battle Royale"],
    viewCount: 8920,
    isLive: true,
    language: "en"
  },
  {
    id: "3",
    title: "Clash of clans Live play",
    thumbnailUrl: "/Images/clash.png",
    username: "GameMaster",
    category: "Games",
    tags: ["Strategy", "Mobile"],
    viewCount: 5670,
    isLive: true,
    language: "en"
  },
  {
    id: "4",
    title: "FORTNITE",
    thumbnailUrl: "/Images/fortnite.png",
    username: "EpicPlayer",
    category: "Games",
    tags: ["Shooter", "Competitive"],
    viewCount: 12340,
    isLive: true,
    language: "en"
  },
  {
    id: "5",
    title: "Clash of clans Live play",
    thumbnailUrl: "/Images/clash.png",
    username: "MobileGamer",
    category: "Games",
    tags: ["Mobile", "Strategy"],
    viewCount: 7890,
    isLive: true,
    language: "en"
  },
  {
    id: "6",
    title: "FORTNITE",
    thumbnailUrl: "/Images/fortnite.png",
    username: "BattleRoyale",
    category: "Games",
    tags: ["FPS", "Esports"],
    viewCount: 15670,
    isLive: true,
    language: "en"
  },
  {
    id: "7",
    title: "Cooking with Chef Maria - Italian Pasta",
    thumbnailUrl: "/Images/game.png",
    username: "chefmaria",
    category: "Cooking",
    tags: ["Cooking", "Food", "Italian"],
    viewCount: 8230,
    isLive: true,
    language: "en"
  },
  {
    id: "8",
    title: "Art Stream - Digital Painting",
    thumbnailUrl: "/Images/game.png",
    username: "digitalartist",
    category: "Art",
    tags: ["Art", "Digital", "Creative"],
    viewCount: 3420,
    isLive: true,
    language: "en"
  },
  {
    id: "9",
    title: "Fitness Workout Live",
    thumbnailUrl: "/Images/game.png",
    username: "fitnesstrainer",
    category: "Fitness",
    tags: ["Fitness", "Workout", "Health"],
    viewCount: 2890,
    isLive: true,
    language: "en"
  },
  {
    id: "10",
    title: "Tech Talk - Latest Gadgets",
    thumbnailUrl: "/Images/game.png",
    username: "techreviewer",
    category: "Tech",
    tags: ["Tech", "Gadgets", "Review"],
    viewCount: 4560,
    isLive: true,
    language: "en"
  },
  {
    id: "11",
    title: "Music Production Live",
    thumbnailUrl: "/Images/game.png",
    username: "musicproducer",
    category: "Music",
    tags: ["Music", "Production", "Creative"],
    viewCount: 3780,
    isLive: true,
    language: "en"
  },
  {
    id: "12",
    title: "Travel Vlog - Paris Streets",
    thumbnailUrl: "/Images/game.png",
    username: "travelvlogger",
    category: "Travel",
    tags: ["Travel", "Vlog", "Paris"],
    viewCount: 6120,
    isLive: true,
    language: "en"
  }
]; 