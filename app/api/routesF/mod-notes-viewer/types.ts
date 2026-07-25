export interface ModNote {
  id: string;
  creator_id: string;
  viewer_id: string;
  mod_id: string;
  note: string;
  created_at: number;
  updated_at: number;
}

export interface ModNoteCreateRequest {
  creator_id: string;
  viewer_id: string;
  mod_id: string;
  note: string;
}

export interface ModNoteCreateResponse {
  id: string;
  success: boolean;
  created_at: number;
}

export interface ModNoteListResponse {
  notes: ModNote[];
  total: number;
}

export interface ModNoteDeleteResponse {
  success: boolean;
}

export interface ModNoteUpdateRequest {
  note_id: string;
  mod_id: string;
  note: string;
}

export interface ModNoteUpdateResponse {
  success: boolean;
  updated_at: number;
}
