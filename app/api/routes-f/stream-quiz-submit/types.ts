export interface SubmitQuizBody {
  quizId: string;
  viewer_id: string;
  answer: number[];
}

export interface SubmitQuizResponse {
  score: number;
  total: number;
  rank: number;
}
