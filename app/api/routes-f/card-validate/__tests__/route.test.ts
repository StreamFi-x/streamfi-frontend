import { POST } from '../route';
import { NextRequest } from 'next/server';

// Helper to create a mock NextRequest
function createMockRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/routes-f/card-validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/routes-f/card-validate', () => {
  describe('Luhn validation with industry-standard test cards', () => {
    it('validates Visa test card 4242424242424242', async () => {
      const req = createMockRequest({ number: '4242424242424242' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.brand).toBe('visa');
      expect(data.last4).toBe('4242');
    });

    it('validates Visa test card 4012888888881881', async () => {
      const req = createMockRequest({ number: '4012888888881881' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('visa');
      expect(data.last4).toBe('1881');
    });

    it('validates Mastercard test card 5555555555554444', async () => {
      const req = createMockRequest({ number: '5555555555554444' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('mastercard');
      expect(data.last4).toBe('4444');
    });

    it('validates Mastercard 2-series test card 2223003122003222', async () => {
      const req = createMockRequest({ number: '2223003122003222' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('mastercard');
      expect(data.last4).toBe('3222');
    });

    it('validates Amex test card 378282246310005', async () => {
      const req = createMockRequest({ number: '378282246310005' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('amex');
      expect(data.last4).toBe('0005');
    });

    it('validates Amex test card 371449635398431', async () => {
      const req = createMockRequest({ number: '371449635398431' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('amex');
      expect(data.last4).toBe('8431');
    });

    it('validates Discover test card 6011111111111117', async () => {
      const req = createMockRequest({ number: '6011111111111117' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('discover');
      expect(data.last4).toBe('1117');
    });

    it('validates Discover test card 6011000990139424', async () => {
      const req = createMockRequest({ number: '6011000990139424' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('discover');
      expect(data.last4).toBe('9424');
    });

    it('validates Discover test card starting with 65', async () => {
      // 65 prefix Discover — using a known valid Luhn number
      const req = createMockRequest({ number: '6510000000000132' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('discover');
    });
  });

  describe('Input sanitization', () => {
    it('strips spaces from card number', async () => {
      const req = createMockRequest({ number: '4242 4242 4242 4242' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('visa');
      expect(data.last4).toBe('4242');
    });

    it('strips dashes from card number', async () => {
      const req = createMockRequest({ number: '4242-4242-4242-4242' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('visa');
      expect(data.last4).toBe('4242');
    });

    it('strips mixed spaces and dashes', async () => {
      const req = createMockRequest({ number: '4242 4242-4242 4242' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.last4).toBe('4242');
    });
  });

  describe('Invalid inputs', () => {
    it('rejects card numbers > 19 digits with 400', async () => {
      const req = createMockRequest({ number: '424242424242424242424' }); // 21 digits
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('exceeds maximum length');
    });

    it('rejects non-digit characters other than spaces/dashes', async () => {
      const req = createMockRequest({ number: '4242-4242-4242-abcd' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('only digits');
    });

    it('rejects missing number field', async () => {
      const req = createMockRequest({});
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('number');
    });

    it('rejects invalid number type', async () => {
      const req = createMockRequest({ number: 4242424242424242 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
    });
  });

  describe('Luhn algorithm rejects invalid cards', () => {
    it('rejects a single digit', async () => {
      const req = createMockRequest({ number: '4' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(false);
    });

    it('rejects an invalid Visa-like number', async () => {
      const req = createMockRequest({ number: '4242424242424243' }); // last digit changed
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(false);
      expect(data.brand).toBe('visa');
    });

    it('rejects an invalid Mastercard-like number', async () => {
      const req = createMockRequest({ number: '5555555555554445' }); // last digit changed
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(false);
      expect(data.brand).toBe('mastercard');
    });

    it('rejects random string of digits', async () => {
      const req = createMockRequest({ number: '1234567890123456' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(false);
    });
  });

  describe('Brand detection edge cases', () => {
    it('returns null brand for unknown prefix', async () => {
      const req = createMockRequest({ number: '9999999999999999' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.brand).toBeNull();
    });

    it('detects Mastercard 51 prefix', async () => {
      // 5105 1051 0510 5100 is a known Stripe test card (Mastercard prepaid)
      const req = createMockRequest({ number: '5105105105105100' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.brand).toBe('mastercard');
    });

    it('detects Mastercard 2221 prefix boundary', async () => {
      const req = createMockRequest({ number: '2221000000000009' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.brand).toBe('mastercard');
    });

    it('detects Mastercard 2720 prefix boundary', async () => {
      const req = createMockRequest({ number: '2720000000000005' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.brand).toBe('mastercard');
    });
  });

  describe('Security: never exposes full PAN', () => {
    it('only returns last 4 digits', async () => {
      const req = createMockRequest({ number: '4242424242424242' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.last4).toBe('4242');
      expect(data).not.toHaveProperty('number');
      expect(data).not.toHaveProperty('pan');
    });
  });
});