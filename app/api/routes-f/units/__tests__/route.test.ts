import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock the URL constructor to avoid issues in test environment
global.URL = class MockURL {
  searchParams: URLSearchParams;
  constructor(url: string, base?: string) {
    this.searchParams = new URLSearchParams(url.split('?')[1] || '');
  }
} as any;

describe('Unit Converter API', () => {
  describe('Length conversions', () => {
    test('should convert kilometers to miles', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=km&to=mi&value=10');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(6.21371, 5);
      expect(data.from).toBe('km');
      expect(data.to).toBe('mi');
      expect(data.value).toBe(10);
    });

    test('should convert meters to feet', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=m&to=ft&value=5');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(16.4042, 4);
    });

    test('should convert inches to centimeters', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=in&to=cm&value=12');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(30.48, 4);
    });

    test('should convert yards to meters', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=yd&to=m&value=100');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(91.44, 4);
    });
  });

  describe('Mass conversions', () => {
    test('should convert kilograms to pounds', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=kg&to=lb&value=10');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(22.0462, 4);
    });

    test('should convert grams to ounces', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=g&to=oz&value=100');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(3.5274, 4);
    });

    test('should convert milligrams to grams', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=mg&to=g&value=1000');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBe(1);
    });
  });

  describe('Volume conversions', () => {
    test('should convert liters to gallons', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=l&to=gal&value=10');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(2.64172, 5);
    });

    test('should convert milliliters to fluid ounces', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=ml&to=fl_oz&value=500');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(16.907, 3);
    });

    test('should convert quarts to pints', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=qt&to=pt&value=2');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(4, 1);
    });
  });

  describe('Temperature conversions', () => {
    test('should convert Celsius to Fahrenheit', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=c&to=f&value=0');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBe(32);
    });

    test('should convert Celsius to Kelvin', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=c&to=k&value=0');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(273.15, 2);
    });

    test('should convert Fahrenheit to Celsius', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=f&to=c&value=212');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBe(100);
    });

    test('should convert Kelvin to Celsius', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=k&to=c&value=273.15');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(0, 1);
    });

    test('should convert Fahrenheit to Kelvin', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=f&to=k&value=32');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted).toBeCloseTo(273.15, 2);
    });
  });

  describe('Error handling', () => {
    test('should reject cross-category conversions', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=km&to=lb&value=10');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Cannot convert between different categories');
    });

    test('should reject missing parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=km&to=mi');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required parameters');
    });

    test('should reject invalid value parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=km&to=mi&value=invalid');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid value parameter');
    });

    test('should reject unknown units', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=unknown&to=mi&value=10');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown unit');
    });
  });

  describe('Precision tests', () => {
    test('should round to 6 decimal places', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/units?from=km&to=mi&value=1');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.converted.toString()).toMatch(/^\d+\.\d{0,6}$/);
    });
  });
});
