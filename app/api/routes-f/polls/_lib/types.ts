export interface PollOption {
  text: string;
  vote_count: number;
}

export interface PublicPoll {
  id: string;
  question: string;
  options: PollOption[];
  total_votes: number;
  created_at: string;
}

export interface PollRecord extends PublicPoll {
  voter_ips: Set<string>;
}
