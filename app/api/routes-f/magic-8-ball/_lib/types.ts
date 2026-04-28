export type AnswerCategory = "positive" | "neutral" | "negative";

export interface Answer {
  text: string;
  category: AnswerCategory;
}

export interface Magic8BallResponse {
  question: string;
  answer: string;
  category: AnswerCategory;
}

export interface StatsResponse {
  total_asks: number;
}
