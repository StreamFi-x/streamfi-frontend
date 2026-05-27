/**
 * @jest-environment jsdom
 */

import { GET } from '../http-status/route';
import { NextRequest } from 'next/server';

// Mock the data module
jest.mock('../http-status/data', () => ({
  getStatusByCode: jest.fn(),
  getStatusesByCategory: jest.fn(),
  findNearestStatus: jest.fn(),
}));

const { getStatusByCode, getStatusesByCategory, findNearestStatus } = require('../http-status/data');

describe('/api/routes-f/http-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET with code parameter', () => {
    it('should return status details for valid code', async () => {
      const mockStatus = {
        code: 404,
        name: 'Not Found',
        description: 'The server can not find the requested resource',
        category: '4xx',
        rfc: 'RFC 7231'
      };

      getStatusByCode.mockReturnValue(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/routes-f/http-status?code=404');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockStatus);
      expect(getStatusByCode).toHaveBeenCalledWith(404);
    });

    it('should return 404 for unknown status code with suggestion', async () => {
      getStatusByCode.mockReturnValue(undefined);
      
      const nearestStatus = {
        code: 404,
        name: 'Not Found',
        description: 'The server can not find the requested resource',
        category: '4xx'
      };
      
      findNearestStatus.mockReturnValue(nearestStatus);

      const request = new NextRequest('http://localhost:3000/api/routes-f/http-status?code=403');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('HTTP status code 403 not found');
      expect(data.suggestion).toContain('Did you mean 404');
      expect(findNearestStatus).toHaveBeenCalledWith(403);
    });

    it('should return 400 for invalid code format', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/http-status?code=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid status code format');
    });
  });

  describe('GET without code parameter', () => {
    it('should return all statuses grouped by category', async () => {
      const mockGroupedStatuses = {
        '2xx': [
          {
            code: 200,
            name: 'OK',
            description: 'The request succeeded',
            category: '2xx',
            rfc: 'RFC 7231'
          }
        ],
        '4xx': [
          {
            code: 404,
            name: 'Not Found',
            description: 'The server can not find the requested resource',
            category: '4xx',
            rfc: 'RFC 7231'
          }
        ]
      };

      getStatusesByCategory.mockReturnValue(mockGroupedStatuses);

      const request = new NextRequest('http://localhost:3000/api/routes-f/http-status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockGroupedStatuses);
      expect(getStatusesByCategory).toHaveBeenCalled();
    });
  });
});
