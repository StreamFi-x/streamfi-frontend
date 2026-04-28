import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('/api/routes-f/horoscope', () => {
  describe('GET', () => {
    it('should return horoscope for valid sign and date', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/horoscope?sign=virgo&date=2024-01-15');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sign).toBe('virgo');
      expect(data.date).toBe('2024-01-15');
      expect(data.reading).toBeDefined();
      expect(data.lucky_number).toBeGreaterThanOrEqual(1);
      expect(data.lucky_number).toBeLessThanOrEqual(100);
      expect(data.lucky_color).toBeDefined();
      expect(data.mood).toBeDefined();
    });

    it('should handle all 12 zodiac signs', async () => {
      const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                   'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
      
      for (const sign of signs) {
        const request = new NextRequest(`http://localhost/api/routes-f/horoscope?sign=${sign}&date=2024-01-15`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.sign).toBe(sign);
        expect(data.reading).toBeDefined();
        expect(data.lucky_number).toBeDefined();
        expect(data.lucky_color).toBeDefined();
        expect(data.mood).toBeDefined();
      }
    });

    it('should be deterministic for same sign and date', async () => {
      const request1 = new NextRequest('http://localhost/api/routes-f/horoscope?sign=leo&date=2024-01-15');
      const response1 = await GET(request1);
      const data1 = await response1.json();

      const request2 = new NextRequest('http://localhost/api/routes-f/horoscope?sign=leo&date=2024-01-15');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1).toEqual(data2);
    });

    it('should return different results for different dates', async () => {
      const request1 = new NextRequest('http://localhost/api/routes-f/horoscope?sign=cancer&date=2024-01-15');
      const response1 = await GET(request1);
      const data1 = await response1.json();

      const request2 = new NextRequest('http://localhost/api/routes-f/horoscope?sign=cancer&date=2024-01-16');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.reading).not.toBe(data2.reading);
    });

    it('should return different results for different signs', async () => {
      const request1 = new NextRequest('http://localhost/api/routes-f/horoscope?sign=aries&date=2024-01-15');
      const response1 = await GET(request1);
      const data1 = await response1.json();

      const request2 = new NextRequest('http://localhost/api/routes-f/horoscope?sign=taurus&date=2024-01-15');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.reading).not.toBe(data2.reading);
    });

    it('should handle case insensitive sign input', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/horoscope?sign=VIRGO&date=2024-01-15');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sign).toBe('virgo');
    });

    it('should handle sign with extra whitespace', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/horoscope?sign=  virgo  &date=2024-01-15');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sign).toBe('virgo');
    });

    it('should reject invalid zodiac sign', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/horoscope?sign=invalid&date=2024-01-15');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid zodiac sign');
    });

    it('should reject invalid date format', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/horoscope?sign=virgo&date=invalid-date');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid date format');
    });

    it('should reject missing sign parameter', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/horoscope?date=2024-01-15');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Both \'sign\' and \'date\' query parameters are required');
    });

    it('should reject missing date parameter', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/horoscope?sign=virgo');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Both \'sign\' and \'date\' query parameters are required');
    });

    it('should reject empty parameters', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/horoscope?sign=&date=');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Both \'sign\' and \'date\' query parameters are required');
    });

    it('should handle edge case dates', async () => {
      const dates = ['2024-01-01', '2024-12-31', '2024-02-29']; // leap year
      
      for (const date of dates) {
        const request = new NextRequest(`http://localhost/api/routes-f/horoscope?sign=aquarius&date=${date}`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.date).toBe(date);
        expect(data.reading).toBeDefined();
      }
    });
  });
});
