/**
 * @jest-environment jsdom
 */

import { POST } from '../case-convert/route';
import { NextRequest } from 'next/server';

// Mock the data module
jest.mock('../case-convert/data', () => ({
  convertCase: jest.fn(),
}));

const { convertCase } = require('../case-convert/data');

describe('/api/routes-f/case-convert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should return all case formats when no target specified', async () => {
      const mockConversions = {
        camelCase: 'helloWorld',
        snake_case: 'hello_world',
        'kebab-case': 'hello-world',
        PascalCase: 'HelloWorld',
        CONSTANT_CASE: 'HELLO_WORLD',
        'Title Case': 'Hello World',
        'Sentence case': 'Hello world'
      };

      convertCase.mockReturnValue(mockConversions);

      const request = new NextRequest('http://localhost:3000/api/routes-f/case-convert', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Hello World'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockConversions);
      expect(convertCase).toHaveBeenCalledWith('Hello World', undefined);
    });

    it('should return specific case format when target specified', async () => {
      const mockConversion = {
        result: 'helloWorld'
      };

      convertCase.mockReturnValue(mockConversion);

      const request = new NextRequest('http://localhost:3000/api/routes-f/case-convert', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Hello World',
          target: 'camelCase'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockConversion);
      expect(convertCase).toHaveBeenCalledWith('Hello World', 'camelCase');
    });

    it('should handle mixed case inputs', async () => {
      const mockConversions = {
        camelCase: 'helloWorldTest',
        snake_case: 'hello_world_test',
        'kebab-case': 'hello-world-test',
        PascalCase: 'HelloWorldTest',
        CONSTANT_CASE: 'HELLO_WORLD_TEST',
        'Title Case': 'Hello World Test',
        'Sentence case': 'Hello world test'
      };

      convertCase.mockReturnValue(mockConversions);

      const request = new NextRequest('http://localhost:3000/api/routes-f/case-convert', {
        method: 'POST',
        body: JSON.stringify({
          text: 'HelloWorld_test-case'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockConversions);
      expect(convertCase).toHaveBeenCalledWith('HelloWorld_test-case', undefined);
    });

    it('should preserve numbers in identifiers', async () => {
      const mockConversions = {
        camelCase: 'test123Value',
        snake_case: 'test_123_value',
        'kebab-case': 'test-123-value',
        PascalCase: 'Test123Value',
        CONSTANT_CASE: 'TEST_123_VALUE',
        'Title Case': 'Test 123 Value',
        'Sentence case': 'Test 123 value'
      };

      convertCase.mockReturnValue(mockConversions);

      const request = new NextRequest('http://localhost:3000/api/routes-f/case-convert', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test123Value'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockConversions);
      expect(convertCase).toHaveBeenCalledWith('Test123Value', undefined);
    });

    it('should return 400 for missing request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/case-convert', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request body');
    });

    it('should return 400 for invalid target case', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/case-convert', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Hello World',
          target: 'invalidCase'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid target case');
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/case-convert', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should handle empty string input', async () => {
      const mockConversions = {};

      convertCase.mockReturnValue(mockConversions);

      const request = new NextRequest('http://localhost:3000/api/routes-f/case-convert', {
        method: 'POST',
        body: JSON.stringify({
          text: ''
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockConversions);
      expect(convertCase).toHaveBeenCalledWith('', undefined);
    });
  });
});
