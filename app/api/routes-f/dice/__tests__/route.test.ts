import { NextRequest } from 'next/server';
import { POST } from '../route';
import { parseDiceNotation, rollDice, SeededRandom } from '../_lib/helpers';

// Mock the NextRequest json method
global.Request = class MockRequest {
  json: () => Promise<any>;
  constructor(input: string | Request, init?: RequestInit) {
    this.json = async () => (init as any)?.body || {};
  }
} as any;

// Mock NextRequest
global.NextRequest = class MockNextRequest extends Request {
  constructor(input: string | Request, init?: RequestInit) {
    super(input, init);
  }
} as any;

describe('Dice API', () => {
  describe('parseDiceNotation', () => {
    test('should parse basic dice notation XdY', () => {
      const result = parseDiceNotation('3d6');
      expect(result).toEqual({
        count: 3,
        sides: 6,
        modifier: 0,
        keepHighest: undefined,
        dropLowest: undefined
      });
    });

    test('should parse dice notation with positive modifier', () => {
      const result = parseDiceNotation('2d8+3');
      expect(result).toEqual({
        count: 2,
        sides: 8,
        modifier: 3,
        keepHighest: undefined,
        dropLowest: undefined
      });
    });

    test('should parse dice notation with negative modifier', () => {
      const result = parseDiceNotation('4d10-2');
      expect(result).toEqual({
        count: 4,
        sides: 10,
        modifier: -2,
        keepHighest: undefined,
        dropLowest: undefined
      });
    });

    test('should parse keep highest notation', () => {
      const result = parseDiceNotation('4d6k3');
      expect(result).toEqual({
        count: 4,
        sides: 6,
        modifier: 0,
        keepHighest: 3,
        dropLowest: undefined
      });
    });

    test('should parse drop lowest notation', () => {
      const result = parseDiceNotation('5d8dl2');
      expect(result).toEqual({
        count: 5,
        sides: 8,
        modifier: 0,
        keepHighest: undefined,
        dropLowest: 2
      });
    });

    test('should parse complex notation with modifier and keep', () => {
      const result = parseDiceNotation('6d10+4k2');
      expect(result).toEqual({
        count: 6,
        sides: 10,
        modifier: 4,
        keepHighest: 2,
        dropLowest: undefined
      });
    });

    test('should handle whitespace and case', () => {
      const result = parseDiceNotation('  2D6+1  ');
      expect(result).toEqual({
        count: 2,
        sides: 6,
        modifier: 1,
        keepHighest: undefined,
        dropLowest: undefined
      });
    });

    test('should reject invalid notation', () => {
      expect(() => parseDiceNotation('invalid')).toThrow('Invalid dice notation');
      expect(() => parseDiceNotation('d6')).toThrow('Invalid dice notation');
      expect(() => parseDiceNotation('6d')).toThrow('Invalid dice notation');
      expect(() => parseDiceNotation('6d6x')).toThrow('Invalid dice notation');
    });

    test('should enforce dice count limits', () => {
      expect(() => parseDiceNotation('101d6')).toThrow('Maximum 100 dice per roll allowed');
      expect(() => parseDiceNotation('0d6')).toThrow('Must roll at least 1 die');
    });

    test('should enforce side limits', () => {
      expect(() => parseDiceNotation('6d1001')).toThrow('Maximum 1000 sides per die allowed');
      expect(() => parseDiceNotation('6d0')).toThrow('Dice must have at least 1 side');
    });

    test('should validate keep highest limits', () => {
      expect(() => parseDiceNotation('3d6k3')).toThrow('Keep highest value must be less than total dice count');
      expect(() => parseDiceNotation('3d6k0')).toThrow('Keep highest value must be at least 1');
    });

    test('should validate drop lowest limits', () => {
      expect(() => parseDiceNotation('3d6dl3')).toThrow('Drop lowest value must be less than total dice count');
      expect(() => parseDiceNotation('3d6dl0')).toThrow('Drop lowest value must be at least 1');
    });
  });

  describe('SeededRandom', () => {
    test('should produce consistent results with same seed', () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);
      
      for (let i = 0; i < 10; i++) {
        expect(rng1.nextInt(1, 6)).toBe(rng2.nextInt(1, 6));
      }
    });

    test('should produce different results with different seeds', () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(54321);
      
      const results1 = Array.from({ length: 10 }, () => rng1.nextInt(1, 6));
      const results2 = Array.from({ length: 10 }, () => rng2.nextInt(1, 6));
      
      expect(results1).not.toEqual(results2);
    });

    test('should respect bounds', () => {
      const rng = new SeededRandom(12345);
      
      for (let i = 0; i < 1000; i++) {
        const result = rng.nextInt(1, 6);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('rollDice', () => {
    test('should roll basic dice without seed', () => {
      const parsed = { count: 3, sides: 6, modifier: 0 };
      const result = rollDice(parsed);
      
      expect(result.rolls).toHaveLength(3);
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.total).toBeLessThanOrEqual(18);
      expect(result.dropped).toBeUndefined();
      
      result.rolls.forEach(roll => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      });
    });

    test('should roll dice with positive modifier', () => {
      const parsed = { count: 2, sides: 8, modifier: 3 };
      const result = rollDice(parsed);
      
      expect(result.rolls).toHaveLength(2);
      expect(result.total).toBeGreaterThanOrEqual(5); // 2*1 + 3
      expect(result.total).toBeLessThanOrEqual(19); // 2*8 + 3
    });

    test('should roll dice with negative modifier', () => {
      const parsed = { count: 1, sides: 20, modifier: -5 };
      const result = rollDice(parsed);
      
      expect(result.rolls).toHaveLength(1);
      expect(result.total).toBeGreaterThanOrEqual(-4); // 1 - 5
      expect(result.total).toBeLessThanOrEqual(15); // 20 - 5
    });

    test('should handle keep highest correctly', () => {
      const parsed = { count: 4, sides: 6, modifier: 0, keepHighest: 2 };
      const result = rollDice(parsed);
      
      expect(result.rolls).toHaveLength(2);
      expect(result.dropped).toHaveLength(2);
      expect(result.total).toBe(result.rolls.reduce((sum, roll) => sum + roll, 0));
      
      // All rolls should be from the original 4 dice
      const allRolls = [...result.rolls, ...result.dropped];
      allRolls.forEach(roll => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      });
    });

    test('should handle drop lowest correctly', () => {
      const parsed = { count: 5, sides: 8, modifier: 0, dropLowest: 2 };
      const result = rollDice(parsed);
      
      expect(result.rolls).toHaveLength(3);
      expect(result.dropped).toHaveLength(2);
      expect(result.total).toBe(result.rolls.reduce((sum, roll) => sum + roll, 0));
      
      // All rolls should be from the original 5 dice
      const allRolls = [...result.rolls, ...result.dropped];
      allRolls.forEach(roll => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(8);
      });
    });

    test('should be deterministic with seed', () => {
      const parsed = { count: 3, sides: 6, modifier: 0 };
      const result1 = rollDice(parsed, 12345);
      const result2 = rollDice(parsed, 12345);
      
      expect(result1.rolls).toEqual(result2.rolls);
      expect(result1.total).toBe(result2.total);
      expect(result1.dropped).toEqual(result2.dropped);
    });
  });

  describe('POST /api/routes-f/dice', () => {
    test('should handle basic dice roll', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '3d6' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.notation).toBe('3d6');
      expect(data.rolls).toHaveLength(3);
      expect(data.total).toBeGreaterThanOrEqual(3);
      expect(data.total).toBeLessThanOrEqual(18);
      expect(data.dropped).toBeUndefined();
    });

    test('should handle dice roll with modifier', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '2d8+3' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.notation).toBe('2d8+3');
      expect(data.rolls).toHaveLength(2);
      expect(data.total).toBeGreaterThanOrEqual(5); // 2*1 + 3
      expect(data.total).toBeLessThanOrEqual(19); // 2*8 + 3
    });

    test('should handle keep highest notation', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '4d6k3' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.notation).toBe('4d6k3');
      expect(data.rolls).toHaveLength(3);
      expect(data.dropped).toHaveLength(1);
    });

    test('should handle drop lowest notation', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '5d8dl2' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.notation).toBe('5d8dl2');
      expect(data.rolls).toHaveLength(3);
      expect(data.dropped).toHaveLength(2);
    });

    test('should handle seeded rolls', async () => {
      const request1 = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '3d6', seed: 12345 })
      });
      
      const request2 = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '3d6', seed: 12345 })
      });
      
      const response1 = await POST(request1);
      const response2 = await POST(request2);
      const data1 = await response1.json();
      const data2 = await response2.json();
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.rolls).toEqual(data2.rolls);
      expect(data1.total).toBe(data2.total);
    });

    test('should reject missing notation', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required parameter: notation');
    });

    test('should reject invalid notation', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: 'invalid' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid dice notation');
    });

    test('should reject invalid seed', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '3d6', seed: 'invalid' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Seed must be an integer');
    });

    test('should enforce dice count limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '101d6' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Maximum 100 dice per roll allowed');
    });

    test('should enforce sides limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/dice', {
        method: 'POST',
        body: JSON.stringify({ notation: '6d1001' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Maximum 1000 sides per die allowed');
    });
  });
});
