export interface FeedbackRequest {
  message: string;
  category: "bug" | "feature" | "other";
  contact?: string;
}

export interface StoredFeedback extends FeedbackRequest {
  id: string;
  createdAt: string;
  ip: string;
}
