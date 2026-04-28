import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('/api/routes-f/roman', () => {
  describe('GET', () => {
    it('should convert number to Roman numeral', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=1994');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('MCMXCIV');
    });

    it('should convert Roman numeral to number', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_number=MCMXCIV');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.number).toBe(1994);
    });

    it('handle boundary values - 1 to I', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('I');
    });

    it('handle boundary values - 3999 to MMMCMXCIX', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=3999');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('MMMCMXCIX');
    });

    it('handle tricky subtractive cases - 4 to IV', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=4');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('IV');
    });

    it('handle tricky subtractive cases - 9 to IX', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=9');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('IX');
    });

    it('handle tricky subtractive cases - 40 to XL', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=40');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('XL');
    });

    it('handle tricky subtractive cases - 90 to XC', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=90');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('XC');
    });

    it('handle tricky subtractive cases - 400 to CD', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=400');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('CD');
    });

    it('handle tricky subtractive cases - 900 to CM', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=900');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roman).toBe('CM');
    });

    it('ensure round-trip conversion is lossless', async () => {
      // Test several random numbers
      const testNumbers = [1, 4, 9, 44, 99, 399, 944, 1994, 3999];
      
      for (const num of testNumbers) {
        // Convert to Roman
        const toRomanRequest = new NextRequest(`http://localhost/api/routes-f/roman?to_roman=${num}`);
        const toRomanResponse = await GET(toRomanRequest);
        const toRomanData = await toRomanResponse.json();
        
        expect(toRomanResponse.status).toBe(200);
        expect(toRomanData.roman).toBeDefined();

        // Convert back to number
        const toNumberRequest = new NextRequest(`http://localhost/api/routes-f/roman?to_number=${toRomanData.roman}`);
        const toNumberResponse = await GET(toNumberRequest);
        const toNumberData = await toNumberResponse.json();
        
        expect(toNumberResponse.status).toBe(200);
        expect(toNumberData.number).toBe(num);
      }
    });

    it('reject numbers below 1', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('between 1 and 3999');
    });

    it('reject numbers above 3999', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=4000');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('between 1 and 3999');
    });

    it('reject invalid Roman numerals - IIII', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_number=IIII');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid Roman numeral format');
    });

    it('reject invalid Roman numerals - VV', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_number=VV');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid Roman numeral format');
    });

    it('reject invalid Roman numerals - IC', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_number=IC');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid Roman numeral format');
    });

    it('reject invalid Roman numerals with invalid characters', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_number=ABC');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid Roman numeral character');
    });

    it('reject invalid number parameter', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_roman=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid number parameter');
    });

    it('reject missing parameters', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Either to_roman or to_number parameter required');
    });

    it('reject empty Roman numeral parameter', async () => {
      const request = new NextRequest('http://localhost/api/routes-f/roman?to_number=');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Roman numeral parameter required');
    });
  });
});
