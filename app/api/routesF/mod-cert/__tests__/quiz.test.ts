import { gradeQuiz, getQuestions } from '../quizData';

describe('gradeQuiz', () => {
  it('returns passed=true with score >= 80 for all correct answers', () => {
    const questions = getQuestions();
    const correctAnswers = questions.map((q) => q.correctIndex);

    const result = gradeQuiz(correctAnswers);

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('returns passed=true when exactly 80% (4 out of 5 correct)', () => {
    const questions = getQuestions();
    // First 4 correct, last one wrong
    const answers = questions.slice(0, 4).map((q) => q.correctIndex).concat(
      questions[4].correctIndex === 0 ? 1 : 0,
    );

    const result = gradeQuiz(answers);

    expect(result.score).toBe(80);
    expect(result.passed).toBe(true);
  });

  it('returns passed=false when score is below 80%', () => {
    // Only 2 out of 5 correct (40%)
    const answers = [0, 1, 0, 1, 0];

    const result = gradeQuiz(answers);

    expect(result.score).toBeLessThan(80);
    expect(result.passed).toBe(false);
  });

  it('returns passed=false for empty answers', () => {
    const result = gradeQuiz([]);

    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('returns passed=false when answers length mismatches questions', () => {
    const result = gradeQuiz([0, 1]);

    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('getQuestions returns 5 questions with all required fields', () => {
    const questions = getQuestions();

    expect(questions.length).toBe(5);
    for (const q of questions) {
      expect(q.id).toBeDefined();
      expect(q.text).toBeDefined();
      expect(q.options.length).toBe(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
    }
  });
});