export interface FakeRecord {
  id: string;
  name: string;
  email: string;
  created_at: string; // ISO string
  category: string;
  status: 'active' | 'inactive' | 'pending';
  score: number;
}

export interface CursorInfo {
  created_at: string;
  id: string;
}

export interface PaginateRequest {
  cursor?: string;
  limit?: number;
}

export interface PaginateResponse {
  data: FakeRecord[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface PaginateError {
  error: string;
}
