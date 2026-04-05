export interface SearchUserResult {
  id: string;
  username: string;
  avatar: string | null;
  is_live: boolean;
  bio: string | null;
  follower_count: number;
}

export interface SearchStreamResult {
  id: string;
  username: string;
  avatar: string | null;
  current_viewers: number;
  stream_title: string;
  category: string;
  tags: string[];
}

export interface SearchCategoryResult {
  id: string;
  title: string;
  tags: string[];
  imageurl: string | null;
}

export interface SearchResponse {
  query: string;
  type: "all" | "users" | "streams" | "categories";
  users: SearchUserResult[];
  streams: SearchStreamResult[];
  categories: SearchCategoryResult[];
}
