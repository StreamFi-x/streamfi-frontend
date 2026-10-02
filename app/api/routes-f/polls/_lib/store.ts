export interface PollOption {
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  stream_id: string;
  question: string;
  options: PollOption[];
  duration_seconds: number;
  created_at: string;
  ends_at: string;
  voters: Set<string>;
}

const store = new Map<string, Poll>();

export function getStore(): Map<string, Poll> {
  return store;
}

export function resetStore(): void {
  store.clear();
}
