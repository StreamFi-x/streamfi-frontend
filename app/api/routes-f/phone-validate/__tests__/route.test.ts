import { POST } from '../route';
import { NextRequest } from 'next/server';
import { sanitizePhone, validatePhone, detectCountry } from '../_lib/helpers';

function createMockRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/routes-f/phone-validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/routes-f/phone-validate', () => {
  describe('US phone numbers', () => {
    it('validates US number with +1 prefix', async () => {
      const req = createMockRequest({ phone: '+14155552671' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.country).toBe('United States');
      expect(data.country_code).toBe('1');
      expect(data.normalized).toBe('+14155552671');
      expect(data.format_national).toBe('(415) 555-2671');
      expect(data.format_international).toBe('+1 415 555 2671');
    });

    it('validates US number with spaces and dashes', async () => {
      const req = createMockRequest({ phone: '+1 (415) 555-2671' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+14155552671');
    });

    it('validates US number with default_country US and no + prefix', async () => {
      const req = createMockRequest({ phone: '4155552671', default_country: 'US' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('United States');
      expect(data.normalized).toBe('+14155552671');
    });
  });

  describe('UK phone numbers', () => {
    it('validates UK number with +44', async () => {
      const req = createMockRequest({ phone: '+447700900123' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('United Kingdom');
      expect(data.country_code).toBe('44');
      expect(data.normalized).toBe('+447700900123');
    });

    it('validates UK number with default_country', async () => {
      const req = createMockRequest({ phone: '07700900123', default_country: 'GB' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+447700900123');
    });
  });

  describe('Nigeria phone numbers', () => {
    it('validates Nigerian number with +234', async () => {
      const req = createMockRequest({ phone: '+2348031234567' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Nigeria');
      expect(data.country_code).toBe('234');
      expect(data.normalized).toBe('+2348031234567');
    });

    it('validates Nigerian number with default_country and leading zero', async () => {
      const req = createMockRequest({ phone: '08031234567', default_country: 'NG' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+2348031234567');
    });
  });

  describe('India phone numbers', () => {
    it('validates Indian number with +91', async () => {
      const req = createMockRequest({ phone: '+919876543210' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('India');
      expect(data.country_code).toBe('91');
      expect(data.normalized).toBe('+919876543210');
    });

    it('validates Indian number with default_country', async () => {
      const req = createMockRequest({ phone: '9876543210', default_country: 'IN' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+919876543210');
    });
  });

  describe('Germany phone numbers', () => {
    it('validates German number with +49', async () => {
      const req = createMockRequest({ phone: '+4915112345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Germany');
      expect(data.country_code).toBe('49');
    });
  });

  describe('France phone numbers', () => {
    it('validates French number with +33', async () => {
      const req = createMockRequest({ phone: '+33612345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('France');
      expect(data.country_code).toBe('33');
    });
  });

  describe('Brazil phone numbers', () => {
    it('validates Brazilian number with +55', async () => {
      const req = createMockRequest({ phone: '+5511912345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Brazil');
      expect(data.country_code).toBe('55');
    });
  });

  describe('Australia phone numbers', () => {
    it('validates Australian number with +61', async () => {
      const req = createMockRequest({ phone: '+61412345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Australia');
      expect(data.country_code).toBe('61');
    });
  });

  describe('Japan phone numbers', () => {
    it('validates Japanese number with +81', async () => {
      const req = createMockRequest({ phone: '+819012345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Japan');
      expect(data.country_code).toBe('81');
    });
  });

  describe('China phone numbers', () => {
    it('validates Chinese number with +86', async () => {
      const req = createMockRequest({ phone: '+8613812345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('China');
      expect(data.country_code).toBe('86');
    });
  });

  describe('Russia phone numbers', () => {
    it('validates Russian number with +7', async () => {
      const req = createMockRequest({ phone: '+79161234567' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Russia');
      expect(data.country_code).toBe('7');
    });
  });

  describe('South Africa phone numbers', () => {
    it('validates South African number with +27', async () => {
      const req = createMockRequest({ phone: '+27123456789' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('South Africa');
      expect(data.country_code).toBe('27');
    });
  });

  describe('Mexico phone numbers', () => {
    it('validates Mexican number with +52', async () => {
      const req = createMockRequest({ phone: '+5215512345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Mexico');
      expect(data.country_code).toBe('52');
    });
  });

  describe('Italy phone numbers', () => {
    it('validates Italian number with +39', async () => {
      const req = createMockRequest({ phone: '+393381234567' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Italy');
      expect(data.country_code).toBe('39');
    });
  });

  describe('Spain phone numbers', () => {
    it('validates Spanish number with +34', async () => {
      const req = createMockRequest({ phone: '+34612345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Spain');
      expect(data.country_code).toBe('34');
    });
  });

  describe('Kenya phone numbers', () => {
    it('validates Kenyan number with +254', async () => {
      const req = createMockRequest({ phone: '+254712345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Kenya');
      expect(data.country_code).toBe('254');
    });
  });

  describe('Ghana phone numbers', () => {
    it('validates Ghanaian number with +233', async () => {
      const req = createMockRequest({ phone: '+233201234567' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Ghana');
      expect(data.country_code).toBe('233');
    });
  });

  describe('Egypt phone numbers', () => {
    it('validates Egyptian number with +20', async () => {
      const req = createMockRequest({ phone: '+201012345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Egypt');
      expect(data.country_code).toBe('20');
    });
  });

  describe('Philippines phone numbers', () => {
    it('validates Philippine number with +63', async () => {
      const req = createMockRequest({ phone: '+639171234567' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Philippines');
      expect(data.country_code).toBe('63');
    });
  });

  describe('South Korea phone numbers', () => {
    it('validates South Korean number with +82', async () => {
      const req = createMockRequest({ phone: '+821012345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('South Korea');
      expect(data.country_code).toBe('82');
    });
  });

  describe('Indonesia phone numbers', () => {
    it('validates Indonesian number with +62', async () => {
      const req = createMockRequest({ phone: '+6281234567890' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Indonesia');
      expect(data.country_code).toBe('62');
    });
  });

  describe('Pakistan phone numbers', () => {
    it('validates Pakistani number with +92', async () => {
      const req = createMockRequest({ phone: '+923001234567' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Pakistan');
      expect(data.country_code).toBe('92');
    });
  });

  describe('Bangladesh phone numbers', () => {
    it('validates Bangladeshi number with +880', async () => {
      const req = createMockRequest({ phone: '+8801712345678' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Bangladesh');
      expect(data.country_code).toBe('880');
    });
  });

  describe('Turkey phone numbers', () => {
    it('validates Turkish number with +90', async () => {
      const req = createMockRequest({ phone: '+905301234567' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Turkey');
      expect(data.country_code).toBe('90');
    });
  });

  describe('Input sanitization', () => {
    it('strips spaces', async () => {
      const req = createMockRequest({ phone: '+1 415 555 2671' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+14155552671');
    });

    it('strips dashes', async () => {
      const req = createMockRequest({ phone: '+1-415-555-2671' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+14155552671');
    });

    it('strips parentheses', async () => {
      const req = createMockRequest({ phone: '+1 (415) 555-2671' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+14155552671');
    });

    it('strips dots', async () => {
      const req = createMockRequest({ phone: '+1.415.555.2671' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+14155552671');
    });

    it('strips leading zeros with default_country', async () => {
      const req = createMockRequest({ phone: '0014155552671', default_country: 'US' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.normalized).toBe('+14155552671');
    });
  });

  describe('E.164 length validation', () => {
    it('rejects number > 15 digits with 400', async () => {
      const req = createMockRequest({ phone: '+1234567890123456' }); // 16 digits
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('exceeds maximum');
    });

    it('accepts number at exactly 15 digits', async () => {
      const req = createMockRequest({ phone: '+123456789012345' }); // 15 digits
      const res = await POST(req);
      const data = await res.json();

      // Should not be 400, may be invalid due to unknown country but not length error
      expect(res.status).not.toBe(400);
    });
  });

  describe('Invalid phone numbers', () => {
    it('returns invalid for wrong length', async () => {
      const req = createMockRequest({ phone: '+1415555' }); // too short for US
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(false);
      expect(data.country).toBe('United States');
    });

    it('returns invalid for unknown country prefix', async () => {
      const req = createMockRequest({ phone: '+9991234567890' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(false);
      expect(data.country).toBe('');
    });

    it('returns invalid when no default_country and no + prefix', async () => {
      const req = createMockRequest({ phone: '4155552671' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('rejects missing phone', async () => {
      const req = createMockRequest({});
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('phone');
    });

    it('rejects empty phone string', async () => {
      const req = createMockRequest({ phone: '' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
    });

    it('rejects invalid default_country type', async () => {
      const req = createMockRequest({ phone: '+14155552671', default_country: 1 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
    });
  });

  describe('Canada / US shared dial code disambiguation', () => {
    it('uses default_country to pick Canada over US for +1 numbers', async () => {
      const req = createMockRequest({ phone: '+14165552671', default_country: 'CA' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('Canada');
    });

    it('defaults to US for +1 when no default_country provided', async () => {
      const req = createMockRequest({ phone: '+14165552671' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.valid).toBe(true);
      expect(data.country).toBe('United States');
    });
  });
});