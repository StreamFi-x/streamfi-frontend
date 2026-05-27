/**
 * @jest-environment jsdom
 */

import { GET } from '../quote/route';
import { NextRequest } from 'next/server';

// Mock the data module
jest.mock('../quote/data', () => ({
  getQuoteById: jest.fn(),
  getRandomQuote: jest.fn(),
  getDeterministicQuote: jest.fn(),
  getCategories: jest.fn(),
  quotes: [
    {
      id: 1,
      text: "The best way to predict the future is to invent it.",
      author: "Alan Kay",
      category: "technology",
      year: 1971
    }
  ]
}));

const { getQuoteById, getRandomQuote, getDeterministicQuote, getCategories, quotes } = require('../quote/data');

describe('/api/routes-f/quote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /quote/[id]', () => {
    it('should return quote by valid ID', async () => {
      const mockQuote = {
        id: 1,
        text: "The best way to predict the future is to invent it.",
        author: "Alan Kay",
        category: "technology",
        year: 1971
      };

      getQuoteById.mockReturnValue(mockQuote);

      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/1');
      const response = await GET(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockQuote);
      expect(getQuoteById).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent quote ID', async () => {
      getQuoteById.mockReturnValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/999');
      const response = await GET(request, { params: { id: '999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Quote with ID 999 not found');
    });

    it('should return 400 for invalid quote ID format', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/invalid');
      const response = await GET(request, { params: { id: 'invalid' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid quote ID format');
    });
  });

  describe('GET /quote/today', () => {
    it('should return deterministic quote for given date', async () => {
      const mockQuote = {
        id: 1,
        text: "The best way to predict the future is to invent it.",
        author: "Alan Kay",
        category: "technology",
        year: 1971
      };

      getDeterministicQuote.mockReturnValue(mockQuote);

      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/today?date=2024-01-01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockQuote);
      expect(getDeterministicQuote).toHaveBeenCalledWith('2024-01-01');
    });

    it('should return deterministic quote for today when no date provided', async () => {
      const mockQuote = {
        id: 1,
        text: "The best way to predict the future is to invent it.",
        author: "Alan Kay",
        category: "technology",
        year: 1971
      };

      getDeterministicQuote.mockReturnValue(mockQuote);

      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/today');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockQuote);
      expect(getDeterministicQuote).toHaveBeenCalled();
    });

    it('should return 400 for invalid date format', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/today?date=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid date format');
    });
  });

  describe('GET /quote/random', () => {
    it('should return random quote', async () => {
      const mockQuote = {
        id: 1,
        text: "The best way to predict the future is to invent it.",
        author: "Alan Kay",
        category: "technology",
        year: 1971
      };

      getRandomQuote.mockReturnValue(mockQuote);

      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/random');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockQuote);
      expect(getRandomQuote).toHaveBeenCalledWith(undefined);
    });

    it('should return random quote from specific category', async () => {
      const mockQuote = {
        id: 1,
        text: "The best way to predict the future is to invent it.",
        author: "Alan Kay",
        category: "technology",
        year: 1971
      };

      getRandomQuote.mockReturnValue(mockQuote);

      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/random?category=technology');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockQuote);
      expect(getRandomQuote).toHaveBeenCalledWith('technology');
    });

    it('should return 400 for invalid category', async () => {
      getCategories.mockReturnValue(['technology', 'inspiration']);

      const request = new NextRequest('http://localhost:3000/api/routes-f/quote/random?category=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Category 'invalid' not found");
      expect(data.availableCategories).toEqual(['technology', 'inspiration']);
    });
  });

  describe('GET /quote (list all)', () => {
    it('should return all quotes', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/quote');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.quotes).toEqual(quotes);
      expect(data.total).toBe(1);
    });
  });
});
