export interface PollChoice {
  label: string;
  votes: number;
}

export interface Poll {
  poll_id: string;
  stream_id: string;
  question: string;
  choices: PollChoice[];
  deadline: string;
  voters: Set<string>;
}

export interface VotePollBody {
  poll_id: string;
  choice_index: number;
  viewer_id: string;
}

export interface VotePollResponse {
  poll_id: string;
  choice_index: number;
  votes: number;
}
