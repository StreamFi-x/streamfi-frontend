import { quizStore } from "../stream-quiz-create/seedData";
import type { Quiz } from "../stream-quiz-create/types";

export class QuizNotFoundError extends Error {}
export class InvalidAnswerError extends Error {}
export class AlreadySubmittedError extends Error {}

interface Submission {
  viewer_id: string;
  score: number;
  submitted_at: number; // epoch ms, used to break rank ties (earliest wins)
}

// Submissions keyed by quiz_id, in submission order.
const submissionsByQuiz = new Map<string, Submission[]>();

function getQuiz(quizId: string): Quiz {
  const quiz = quizStore.get(quizId);
  if (!quiz) {
    throw new QuizNotFoundError(`quiz '${quizId}' not found`);
  }
  return quiz;
}

function validateAnswer(answer: number[], quiz: Quiz): void {
  if (!Array.isArray(answer) || answer.length === 0) {
    throw new InvalidAnswerError("answer must be a non-empty array");
  }
  if (answer.length !== quiz.questions.length) {
    throw new InvalidAnswerError(
      `answer must have exactly ${quiz.questions.length} entries (one per question)`
    );
  }
  answer.forEach((a, i) => {
    if (typeof a !== "number" || !Number.isInteger(a)) {
      throw new InvalidAnswerError(`answer[${i}] must be an integer index`);
    }
  });
}

function scoreAnswer(answer: number[], quiz: Quiz): number {
  return quiz.questions.reduce(
    (score, question, i) =>
      score + (answer[i] === question.correct_answer_index ? 1 : 0),
    0
  );
}

/**
 * Computes a viewer's rank among all submissions for a quiz: 1-based
 * position when sorted by score descending, then by submission time
 * ascending (earlier submitters rank above later ones on a tie).
 */
function computeRank(quizId: string, viewerId: string): number {
  const submissions = submissionsByQuiz.get(quizId) ?? [];
  const sorted = [...submissions].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.submitted_at - b.submitted_at;
  });
  const index = sorted.findIndex((s) => s.viewer_id === viewerId);
  return index === -1 ? sorted.length + 1 : index + 1;
}

export function submitQuizAnswer(
  quizId: string,
  viewerId: string,
  answer: number[],
  now: number = Date.now()
): { score: number; total: number; rank: number } {
  const quiz = getQuiz(quizId);
  validateAnswer(answer, quiz);

  const existing = submissionsByQuiz.get(quizId) ?? [];
  if (existing.some((s) => s.viewer_id === viewerId)) {
    throw new AlreadySubmittedError(
      `viewer '${viewerId}' has already submitted an answer for quiz '${quizId}'`
    );
  }

  const score = scoreAnswer(answer, quiz);
  const submission: Submission = { viewer_id: viewerId, score, submitted_at: now };
  submissionsByQuiz.set(quizId, [...existing, submission]);

  const rank = computeRank(quizId, viewerId);

  return { score, total: quiz.questions.length, rank };
}
