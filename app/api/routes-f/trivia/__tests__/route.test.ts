import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { generateHash } from '../_lib/helpers';

// Mock the questions.json import
jest.mock('../questions.json', () => [
  {
    id: 'sci_001',
    question: 'What is the chemical symbol for gold?',
    answers: ['Go', 'Gd', 'Au', 'Ag'],
    correct_index: 2,
    category: 'science',
    difficulty: 'easy'
  },
  {
    id: 'hist_001',
    question: 'In which year did World War II end?',
    answers: ['1943', '1944', '1945', '1946'],
    correct_index: 2,
    category: 'history',
    difficulty: 'easy'
  },
  {
    id: 'sci_002',
    question: 'What is the speed of light in vacuum?',
    answers: ['299,792,458 m/s', '300,000,000 m/s', '186,282 miles/s', '1 light-year per second'],
    correct_index: 0,
    category: 'science',
    difficulty: 'medium'
  }
]);

describe('Trivia API', () => {
  describe('GET /api/routes-f/trivia', () => {
    it('should return default 1 random question', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions).toHaveLength(1);
      expect(data.questions[0]).toHaveProperty('id');
      expect(data.questions[0]).toHaveProperty('question');
      expect(data.questions[0]).toHaveProperty('answers');
      expect(data.questions[0]).toHaveProperty('correct_hash');
      expect(data.questions[0]).toHaveProperty('category');
      expect(data.questions[0]).toHaveProperty('difficulty');
      expect(data.questions[0]).not.toHaveProperty('correct_index');
    });

    it('should return specified number of questions', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?count=3');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions).toHaveLength(3);
    });

    it('should limit count to maximum 20', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?count=25');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions).toHaveLength(3); // Only 3 questions in mock data
    });

    it('should filter by category', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?category=science');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions.every(q => q.category === 'science')).toBe(true);
    });

    it('should filter by difficulty', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?difficulty=medium');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions.every(q => q.difficulty === 'medium')).toBe(true);
    });

    it('should filter by both category and difficulty', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?category=science&difficulty=easy');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions.every(q => q.category === 'science' && q.difficulty === 'easy')).toBe(true);
    });

    it('should return 404 for no matching questions', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?category=geography');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No questions found matching the specified criteria');
    });

    it('should return 400 for invalid category', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?category=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid category');
    });

    it('should return 400 for invalid difficulty', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?difficulty=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid difficulty');
    });

    it('should return 400 for invalid count', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?count=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Count must be a positive integer');
    });

    it('should generate correct hash for questions', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia?category=science&difficulty=easy');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions[0].correct_hash).toBe(generateHash('sci_001', 2));
    });
  });

  describe('POST /api/routes-f/trivia', () => {
    it('should verify correct answer', async () => {
      const requestBody = {
        question_id: 'sci_001',
        answer_index: 2
      };
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.correct).toBe(true);
      expect(data.correct_index).toBe(2);
    });

    it('should verify incorrect answer', async () => {
      const requestBody = {
        question_id: 'sci_001',
        answer_index: 0
      };
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.correct).toBe(false);
      expect(data.correct_index).toBe(2);
    });

    it('should return 404 for non-existent question', async () => {
      const requestBody = {
        question_id: 'nonexistent',
        answer_index: 0
      };
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Question not found');
    });

    it('should return 400 for missing question_id', async () => {
      const requestBody = {
        answer_index: 0
      };
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('question_id is required');
    });

    it('should return 400 for missing answer_index', async () => {
      const requestBody = {
        question_id: 'sci_001'
      };
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('answer_index is required');
    });

    it('should return 400 for negative answer_index', async () => {
      const requestBody = {
        question_id: 'sci_001',
        answer_index: -1
      };
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('answer_index is required');
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/trivia', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
