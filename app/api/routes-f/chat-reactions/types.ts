export interface ReactionRecord {
  message_id: string;
  emoji: string;
  user_id: string;
}

export interface ReactionAggregate {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
}

export interface ReactionResponse {
  reactions: ReactionAggregate[];
}

export interface PostReactionRequestBody {
  message_id: string;
  emoji: string;
  user_id: string;
}

export interface PostReactionResponse {
  toggled: boolean; // true if added, false if removed
  reactions: ReactionAggregate[];
}
