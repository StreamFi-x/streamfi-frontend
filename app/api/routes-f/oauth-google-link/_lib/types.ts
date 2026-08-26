export interface GoogleLinkRecord {
  user_id: string;
  google_id: string;
  email: string | null;
  linked_at: string;
}

export type LinkResult =
  | { ok: true; record: GoogleLinkRecord }
  | { ok: false; error: string; status: number };
