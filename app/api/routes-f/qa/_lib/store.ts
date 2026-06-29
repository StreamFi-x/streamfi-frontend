export interface Question {
  id: string;
  stream_id: string;
  viewer_id: string;
  question: string;
  score: number;
  answered: boolean;
  answered_by?: string;
  answered_at?: string;
  queued_at: string;
  upvoters: Set<string>;
}

const store = new Map<string, Question>();

export function getStore(): Map<string, Question> {
  return store;
}

export function resetStore(): void {
  store.clear();
}
