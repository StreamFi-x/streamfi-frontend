import type { CreateQuizQuestionInput, Quiz } from "./types";
import { quizStore } from "./seedData";

export class InvalidQuestionsError extends Error {}

function generateQuizId(): string {
  return `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validates a batch of quiz questions: each needs question text, at least
 * two answer options, and a correct_answer_index that actually indexes into
 * its own options array.
 */
export function validateQuestions(questions: CreateQuizQuestionInput[]): void {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new InvalidQuestionsError("questions must be a non-empty array");
  }

  questions.forEach((question, i) => {
    if (!question.text || typeof question.text !== "string") {
      throw new InvalidQuestionsError(`question[${i}].text is required`);
    }
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new InvalidQuestionsError(
        `question[${i}].options must have at least 2 choices`
      );
    }
    if (
      typeof question.correct_answer_index !== "number" ||
      !Number.isInteger(question.correct_answer_index) ||
      question.correct_answer_index < 0 ||
      question.correct_answer_index >= question.options.length
    ) {
      throw new InvalidQuestionsError(
        `question[${i}].correct_answer_index must be a valid index into its options`
      );
    }
  });
}

export function createQuiz(
  streamId: string,
  questions: CreateQuizQuestionInput[]
): Quiz {
  validateQuestions(questions);

  const quiz: Quiz = {
    quiz_id: generateQuizId(),
    stream_id: streamId,
    questions: questions.map((q) => ({
      text: q.text,
      options: q.options,
      correct_answer_index: q.correct_answer_index,
    })),
    created_at: new Date().toISOString(),
  };

  quizStore.set(quiz.quiz_id, quiz);
  return quiz;
}
