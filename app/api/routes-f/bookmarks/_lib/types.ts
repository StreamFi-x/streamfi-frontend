export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type SortField = "created" | "title";
