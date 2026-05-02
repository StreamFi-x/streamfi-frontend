import { TriviaQuestion, TriviaQuestionResponse, TriviaCategory, TriviaDifficulty } from './types';
import questions from '../questions.json';

export function generateHash(questionId: string, correctIndex: number): string {
  const data = `${questionId}:${correctIndex}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

export function filterQuestions(
  category?: TriviaCategory,
  difficulty?: TriviaDifficulty
): TriviaQuestion[] {
  let filtered = questions as TriviaQuestion[];
  
  if (category) {
    filtered = filtered.filter(q => q.category === category);
  }
  
  if (difficulty) {
    filtered = filtered.filter(q => q.difficulty === difficulty);
  }
  
  return filtered;
}

export function getRandomQuestions(
  questions: TriviaQuestion[],
  count: number
): TriviaQuestion[] {
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, questions.length));
}

export function formatQuestionForResponse(question: TriviaQuestion): TriviaQuestionResponse {
  return {
    id: question.id,
    question: question.question,
    answers: question.answers,
    correct_hash: generateHash(question.id, question.correct_index),
    category: question.category,
    difficulty: question.difficulty
  };
}

export function validateAnswer(
  questionId: string,
  answerIndex: number
): { correct: boolean; correct_index: number } | null {
  const question = (questions as TriviaQuestion[]).find(q => q.id === questionId);
  
  if (!question) {
    return null;
  }
  
  return {
    correct: question.correct_index === answerIndex,
    correct_index: question.correct_index
  };
}
