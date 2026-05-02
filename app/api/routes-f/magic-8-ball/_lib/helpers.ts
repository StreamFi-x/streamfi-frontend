import { ANSWERS } from "./answers";
import type { Answer } from "./types";

export const MIN_Q = 3;
export const MAX_Q = 500;

export function pickRandom(): Answer {
  return ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
}

export function validateQuestion(question: unknown): string | null {
  if (question === undefined || question === null) {
    return "question is required";
  }
  if (typeof question !== "string") {
    return "question must be a string";
  }
  if (question.length < MIN_Q) {
    return `question must be at least ${MIN_Q} characters`;
  }
  if (question.length > MAX_Q) {
    return `question must be at most ${MAX_Q} characters`;
  }
  return null;
}
