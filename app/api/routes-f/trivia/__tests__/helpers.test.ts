import { 
  generateHash, 
  filterQuestions, 
  getRandomQuestions, 
  formatQuestionForResponse,
  validateAnswer 
} from '../_lib/helpers';
import { TriviaQuestion } from '../_lib/types';

// Mock questions for testing
const mockQuestions: TriviaQuestion[] = [
  {
    id: 'test_001',
    question: 'Test question 1',
    answers: ['A', 'B', 'C', 'D'],
    correct_index: 2,
    category: 'science',
    difficulty: 'easy'
  },
  {
    id: 'test_002',
    question: 'Test question 2',
    answers: ['X', 'Y', 'Z', 'W'],
    correct_index: 0,
    category: 'history',
    difficulty: 'medium'
  },
  {
    id: 'test_003',
    question: 'Test question 3',
    answers: ['1', '2', '3', '4'],
    correct_index: 1,
    category: 'science',
    difficulty: 'hard'
  }
];

// Mock the questions import
jest.mock('../questions.json', () => mockQuestions);

describe('Trivia Helpers', () => {
  describe('generateHash', () => {
    it('should generate consistent hash for same input', () => {
      const hash1 = generateHash('test_001', 2);
      const hash2 = generateHash('test_001', 2);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = generateHash('test_001', 2);
      const hash2 = generateHash('test_001', 3);
      const hash3 = generateHash('test_002', 2);
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('should generate hexadecimal string', () => {
      const hash = generateHash('test_001', 2);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe('filterQuestions', () => {
    it('should return all questions when no filters provided', () => {
      const result = filterQuestions();
      expect(result).toHaveLength(3);
    });

    it('should filter by category', () => {
      const result = filterQuestions('science');
      expect(result).toHaveLength(2);
      expect(result.every(q => q.category === 'science')).toBe(true);
    });

    it('should filter by difficulty', () => {
      const result = filterQuestions(undefined, 'easy');
      expect(result).toHaveLength(1);
      expect(result[0].difficulty).toBe('easy');
    });

    it('should filter by both category and difficulty', () => {
      const result = filterQuestions('science', 'easy');
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('science');
      expect(result[0].difficulty).toBe('easy');
    });

    it('should return empty array for no matches', () => {
      const result = filterQuestions('geography');
      expect(result).toHaveLength(0);
    });
  });

  describe('getRandomQuestions', () => {
    it('should return requested number of questions', () => {
      const result = getRandomQuestions(mockQuestions, 2);
      expect(result).toHaveLength(2);
    });

    it('should not exceed available questions', () => {
      const result = getRandomQuestions(mockQuestions, 5);
      expect(result).toHaveLength(3);
    });

    it('should return random questions', () => {
      const result1 = getRandomQuestions(mockQuestions, 2);
      const result2 = getRandomQuestions(mockQuestions, 2);
      
      // Results might be the same by chance, but let's run it multiple times
      let foundDifference = false;
      for (let i = 0; i < 10; i++) {
        const test1 = getRandomQuestions(mockQuestions, 2);
        const test2 = getRandomQuestions(mockQuestions, 2);
        if (JSON.stringify(test1) !== JSON.stringify(test2)) {
          foundDifference = true;
          break;
        }
      }
      expect(foundDifference).toBe(true);
    });
  });

  describe('formatQuestionForResponse', () => {
    it('should format question correctly', () => {
      const question: TriviaQuestion = mockQuestions[0];
      const result = formatQuestionForResponse(question);
      
      expect(result.id).toBe(question.id);
      expect(result.question).toBe(question.question);
      expect(result.answers).toBe(question.answers);
      expect(result.category).toBe(question.category);
      expect(result.difficulty).toBe(question.difficulty);
      expect(result).toHaveProperty('correct_hash');
      expect(result).not.toHaveProperty('correct_index');
    });

    it('should generate correct hash', () => {
      const question: TriviaQuestion = mockQuestions[0];
      const result = formatQuestionForResponse(question);
      const expectedHash = generateHash(question.id, question.correct_index);
      
      expect(result.correct_hash).toBe(expectedHash);
    });
  });

  describe('validateAnswer', () => {
    it('should validate correct answer', () => {
      const result = validateAnswer('test_001', 2);
      expect(result).toEqual({
        correct: true,
        correct_index: 2
      });
    });

    it('should validate incorrect answer', () => {
      const result = validateAnswer('test_001', 0);
      expect(result).toEqual({
        correct: false,
        correct_index: 2
      });
    });

    it('should return null for non-existent question', () => {
      const result = validateAnswer('nonexistent', 0);
      expect(result).toBeNull();
    });
  });
});
