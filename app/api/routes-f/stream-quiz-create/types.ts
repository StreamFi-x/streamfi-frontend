export interface QuizQuestion {
  text: string;
  options: string[];
  correct_answer_index: number;
}

export interface Quiz {
  quiz_id: string;
  stream_id: string;
  questions: QuizQuestion[];
  created_at: string;
}

export interface CreateQuizQuestionInput {
  text: string;
  options: string[];
  correct_answer_index: number;
}

export interface CreateQuizBody {
  stream_id: string;
  questions: CreateQuizQuestionInput[];
}

export interface CreateQuizResponse {
  quizId: string;
}
