export interface CreatorNode {
  creator_id: string;
  name: string;
  /** Categories the creator streams in. */
  categories: string[];
  /** Viewer ids that follow this creator. */
  followers: string[];
}

/** Public-facing creator summary (followers omitted for privacy). */
export interface CreatorSummary {
  creator_id: string;
  name: string;
  categories: string[];
}

export interface SimilarCreator {
  creator: CreatorSummary;
  /** Sum of the category Jaccard and follower Jaccard, range 0..2. */
  similarity_score: number;
  reason: string;
}

export interface SimilarCreatorsResponse {
  creators: SimilarCreator[];
}
