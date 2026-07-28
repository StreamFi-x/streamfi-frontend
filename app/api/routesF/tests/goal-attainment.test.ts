/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../goal-attainment/route';
import { goalHistoryRepository } from '../helpers/repositories';

function createRequest(params: Record<string, string>): NextRequest {
  const searchParams = new URLSearchParams(params);
  const url = `http://localhost/api/routesF/goal-attainment?${searchParams.toString()}`;
  return new NextRequest(url);
}

describe('Goal Attainment API', () => {
  beforeEach(() => {
    // Reset repository for each test
    goalHistoryRepository.clear();
  });

  describe('GET /api/routesF/goal-attainment', () => {
    it('returns goal attainment statistics for a creator', async () => {
      // Seed some test data
      goalHistoryRepository.seed([
        {
          id: 'goal_1',
          creator_id: 'creator_001',
          title: 'Test Goal 1',
          target_amount: 100,
          current_amount: 100,
          attained: true,
          ended_at: '2024-01-01T12:00:00Z',
        },
        {
          id: 'goal_2',
          creator_id: 'creator_001',
          title: 'Test Goal 2',
          target_amount: 200,
          current_amount: 150,
          attained: false,
          ended_at: '2024-02-01T12:00:00Z',
        },
        {
          id: 'goal_3',
          creator_id: 'creator_001',
          title: 'Test Goal 3',
          target_amount: 300,
          current_amount: 350,
          attained: true,
          ended_at: '2024-03-01T12:00:00Z',
        },
      ]);

      const request = createRequest({ creator_id: 'creator_001' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        attained: 2,
        missed: 1,
        attainment_rate_percent: 67,
      });
    });

    it('respects last_n_goals parameter', async () => {
      // Seed goals in chronological order
      goalHistoryRepository.seed([
        {
          id: 'goal_old',
          creator_id: 'creator_001',
          title: 'Old Goal',
          target_amount: 100,
          current_amount: 100,
          attained: true,
          ended_at: '2024-01-01T12:00:00Z',
        },
        {
          id: 'goal_new',
          creator_id: 'creator_001',
          title: 'New Goal',
          target_amount: 200,
          current_amount: 100,
          attained: false,
          ended_at: '2024-02-01T12:00:00Z',
        },
      ]);

      const request = createRequest({ 
        creator_id: 'creator_001',
        last_n_goals: '1',
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual({
        attained: 0,
        missed: 1,
        attainment_rate_percent: 0,
      });
    });

    it('handles zero goals for a creator', async () => {
      goalHistoryRepository.seed([
        {
          id: 'goal_other',
          creator_id: 'creator_999',
          title: 'Other Creator Goal',
          target_amount: 100,
          current_amount: 100,
          attained: true,
          ended_at: '2024-01-01T12:00:00Z',
        },
      ]);

      const request = createRequest({ creator_id: 'creator_001' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual({
        attained: 0,
        missed: 0,
        attainment_rate_percent: 0,
      });
    });

    it('requires creator_id parameter', async () => {
      const request = createRequest({});
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('validates last_n_goals as positive integer', async () => {
      const request = createRequest({ 
        creator_id: 'creator_001',
        last_n_goals: 'invalid',
      });
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('sorts goals by ended_at descending (newest first)', async () => {
      goalHistoryRepository.seed([
        {
          id: 'goal_1',
          creator_id: 'creator_001',
          title: 'Oldest',
          target_amount: 100,
          current_amount: 100,
          attained: true,
          ended_at: '2024-01-01T12:00:00Z',
        },
        {
          id: 'goal_2',
          creator_id: 'creator_001',
          title: 'Middle',
          target_amount: 200,
          current_amount: 200,
          attained: true,
          ended_at: '2024-02-01T12:00:00Z',
        },
        {
          id: 'goal_3',
          creator_id: 'creator_001',
          title: 'Newest',
          target_amount: 300,
          current_amount: 150,
          attained: false,
          ended_at: '2024-03-01T12:00:00Z',
        },
      ]);

      const request = createRequest({ 
        creator_id: 'creator_001',
        last_n_goals: '2',
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      // Should only count the 2 newest goals (Middle and Newest)
      expect(data.data).toEqual({
        attained: 1,
        missed: 1,
        attainment_rate_percent: 50,
      });
    });
  });
});