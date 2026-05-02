export interface TriviaQuestion {
  id: string;
  question: string;
  answers: string[];
  correct_index: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TriviaQuestionResponse {
  id: string;
  question: string;
  answers: string[];
  correct_hash: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TriviaQuestionsResponse {
  questions: TriviaQuestionResponse[];
}

export interface VerifyAnswerRequest {
  question_id: string;
  answer_index: number;
}

export interface VerifyAnswerResponse {
  correct: boolean;
  correct_index: number;
}

export type TriviaCategory = 'science' | 'history' | 'geography' | 'entertainment';

export type TriviaDifficulty = 'easy' | 'medium' | 'hard';
