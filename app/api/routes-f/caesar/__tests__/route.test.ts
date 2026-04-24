import { POST } from '../route';
import { NextRequest } from 'next/server';
import { caesarCipher, normalizeShift, isDetectablyEnglish } from '../_lib/helpers';

function createMockRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/routes-f/caesar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/routes-f/caesar', () => {
  describe('Basic encoding', () => {
    it('encodes "Hello" with shift 3', async () => {
      const req = createMockRequest({ text: 'Hello', shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.result).toBe('Khoor');
      expect(data.shift_used).toBe(3);
    });

    it('encodes "ABC" with shift 3 to "DEF"', async () => {
      const req = createMockRequest({ text: 'ABC', shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('DEF');
    });

    it('encodes lowercase "abc" with shift 3 to "def"', async () => {
      const req = createMockRequest({ text: 'abc', shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('def');
    });
  });

  describe('Basic decoding', () => {
    it('decodes "Khoor" with shift 3 back to "Hello"', async () => {
      const req = createMockRequest({ text: 'Khoor', shift: 3, mode: 'decode' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.result).toBe('Hello');
      expect(data.shift_used).toBe(3);
    });

    it('decodes "DEF" with shift 3 back to "ABC"', async () => {
      const req = createMockRequest({ text: 'DEF', shift: 3, mode: 'decode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('ABC');
    });
  });

  describe('Round-trip encode/decode', () => {
    it('is lossless for simple text', async () => {
      const original = 'Hello World';
      const shift = 5;

      // Encode
      const encodeReq = createMockRequest({ text: original, shift, mode: 'encode' });
      const encodeRes = await POST(encodeReq);
      const encoded = (await encodeRes.json()).result;

      // Decode
      const decodeReq = createMockRequest({ text: encoded, shift, mode: 'decode' });
      const decodeRes = await POST(decodeReq);
      const decoded = (await decodeRes.json()).result;

      expect(decoded).toBe(original);
    });

    it('is lossless for mixed case with punctuation', async () => {
      const original = 'Hello, World! 123';
      const shift = 7;

      const encodeReq = createMockRequest({ text: original, shift, mode: 'encode' });
      const encodeRes = await POST(encodeReq);
      const encoded = (await encodeRes.json()).result;

      const decodeReq = createMockRequest({ text: encoded, shift, mode: 'decode' });
      const decodeRes = await POST(decodeReq);
      const decoded = (await decodeRes.json()).result;

      expect(decoded).toBe(original);
    });

    it('is lossless for large text', async () => {
      const original = 'The Quick Brown Fox Jumps Over The Lazy Dog.';
      const shift = 13;

      const encodeReq = createMockRequest({ text: original, shift, mode: 'encode' });
      const encodeRes = await POST(encodeReq);
      const encoded = (await encodeRes.json()).result;

      const decodeReq = createMockRequest({ text: encoded, shift, mode: 'decode' });
      const decodeRes = await POST(decodeReq);
      const decoded = (await decodeRes.json()).result;

      expect(decoded).toBe(original);
    });
  });

  describe('Shift normalization', () => {
    it('normalizes shift 27 to 1', async () => {
      const req = createMockRequest({ text: 'ABC', shift: 27, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.shift_used).toBe(1);
      expect(data.result).toBe('BCD');
    });

    it('normalizes shift -1 to 25', async () => {
      const req = createMockRequest({ text: 'ABC', shift: -1, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.shift_used).toBe(25);
      expect(data.result).toBe('ZAB');
    });

    it('normalizes shift -27 to 25', async () => {
      const req = createMockRequest({ text: 'ABC', shift: -27, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.shift_used).toBe(25);
      expect(data.result).toBe('ZAB');
    });

    it('handles large positive shift', async () => {
      const req = createMockRequest({ text: 'ABC', shift: 100, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.shift_used).toBe(100 % 26); // 22
      expect(data.result).toBe('WXY');
    });

    it('handles large negative shift', async () => {
      const req = createMockRequest({ text: 'ABC', shift: -100, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.shift_used).toBe(4); // (-100 % 26 + 26) % 26 = 4
    });

    it('handles shift 0', async () => {
      const req = createMockRequest({ text: 'Hello', shift: 0, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.shift_used).toBe(0);
      expect(data.result).toBe('Hello');
    });

    it('handles shift 26 (full cycle)', async () => {
      const req = createMockRequest({ text: 'Hello', shift: 26, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.shift_used).toBe(0);
      expect(data.result).toBe('Hello');
    });
  });

  describe('Case preservation', () => {
    it('preserves mixed case', async () => {
      const req = createMockRequest({ text: 'AbCdEf', shift: 1, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('BcDeFg');
    });

    it('preserves all uppercase', async () => {
      const req = createMockRequest({ text: 'HELLO', shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('KHOOR');
    });

    it('preserves all lowercase', async () => {
      const req = createMockRequest({ text: 'hello', shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('khoor');
    });
  });

  describe('Non-alphabetic character preservation', () => {
    it('preserves numbers', async () => {
      const req = createMockRequest({ text: 'Hello123', shift: 1, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('Ifmmp123');
    });

    it('preserves spaces', async () => {
      const req = createMockRequest({ text: 'Hello World', shift: 1, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('Ifmmp Xpsme');
    });

    it('preserves punctuation', async () => {
      const req = createMockRequest({ text: 'Hello, World!', shift: 1, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('Ifmmp, Xpsme!');
    });

    it('preserves special characters', async () => {
      const req = createMockRequest({ text: '@#$%^&*()', shift: 5, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('@#$%^&*()');
    });

    it('preserves unicode/non-ASCII characters', async () => {
      const req = createMockRequest({ text: 'Café résumé naïve', shift: 1, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('Dbgf sftvnf oïwf');
    });
  });

  describe('Warning for unchanged shift with English text', () => {
    it('includes warning when shift is 0 and text is English', async () => {
      const req = createMockRequest({
        text: 'The quick brown fox jumps over the lazy dog',
        shift: 0,
        mode: 'encode',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.warning).toBeDefined();
      expect(data.warning).toContain('no transformation');
    });

    it('includes warning when shift is multiple of 26', async () => {
      const req = createMockRequest({
        text: 'Hello world this is english',
        shift: 52,
        mode: 'encode',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.warning).toBeDefined();
      expect(data.shift_used).toBe(0);
    });

    it('does not include warning for non-English text', async () => {
      const req = createMockRequest({ text: 'Xyz123!@#', shift: 0, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.warning).toBeUndefined();
    });

    it('does not include warning for decode mode', async () => {
      const req = createMockRequest({
        text: 'The quick brown fox',
        shift: 0,
        mode: 'decode',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.warning).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('handles empty string', async () => {
      const req = createMockRequest({ text: '', shift: 5, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('');
      expect(data.shift_used).toBe(5);
    });

    it('handles string with only non-alpha characters', async () => {
      const req = createMockRequest({ text: '12345 !@#$%', shift: 5, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('12345 !@#$%');
    });

    it('wraps Z to A', async () => {
      const req = createMockRequest({ text: 'XYZ', shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('ABC');
    });

    it('wraps z to a', async () => {
      const req = createMockRequest({ text: 'xyz', shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.result).toBe('abc');
    });
  });

  describe('Error handling', () => {
    it('rejects missing text', async () => {
      const req = createMockRequest({ shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('text');
    });

    it('rejects invalid text type', async () => {
      const req = createMockRequest({ text: 123, shift: 3, mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
    });

    it('rejects missing shift', async () => {
      const req = createMockRequest({ text: 'hello', mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('shift');
    });

    it('rejects invalid shift type', async () => {
      const req = createMockRequest({ text: 'hello', shift: 'three', mode: 'encode' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
    });

    it('rejects invalid mode', async () => {
      const req = createMockRequest({ text: 'hello', shift: 3, mode: 'encrypt' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('mode');
    });

    it('rejects missing mode', async () => {
      const req = createMockRequest({ text: 'hello', shift: 3 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
    });
  });
});