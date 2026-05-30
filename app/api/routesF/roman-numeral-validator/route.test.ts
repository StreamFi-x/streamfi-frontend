import { POST } from './route';

async function validate(roman: unknown) {
  const req = new Request('http://localhost/api/routesF/roman-numeral-validator', {
    method: 'POST',
    body: JSON.stringify({ roman }),
  });

  const res = await POST(req);
  return {
    status: res.status,
    data: await res.json(),
  };
}

describe('Roman numeral validator API', () => {
  it('accepts legal strict Roman numerals', async () => {
    await expect(validate('I')).resolves.toEqual({
      status: 200,
      data: { valid: true, value: 1 },
    });

    await expect(validate('IV')).resolves.toEqual({
      status: 200,
      data: { valid: true, value: 4 },
    });

    await expect(validate('XLII')).resolves.toEqual({
      status: 200,
      data: { valid: true, value: 42 },
    });

    await expect(validate('MCMXCIV')).resolves.toEqual({
      status: 200,
      data: { valid: true, value: 1994 },
    });

    await expect(validate('MMMCMXCIX')).resolves.toEqual({
      status: 200,
      data: { valid: true, value: 3999 },
    });
  });

  it('rejects illegal additive and repeated forms', async () => {
    for (const roman of ['IIII', 'VV', 'XXXX', 'LL', 'CCCC', 'DD']) {
      const { status, data } = await validate(roman);

      expect(status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('Roman numeral is not in strict subtractive notation');
    }
  });

  it('rejects illegal subtractive forms', async () => {
    for (const roman of ['IC', 'IL', 'XD', 'XM', 'VX', 'LC']) {
      const { status, data } = await validate(roman);

      expect(status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('Roman numeral is not in strict subtractive notation');
    }
  });

  it('rejects malformed input', async () => {
    await expect(validate('')).resolves.toMatchObject({
      status: 200,
      data: { valid: false, reason: 'Roman numeral cannot be empty' },
    });

    await expect(validate(' ix')).resolves.toMatchObject({
      status: 200,
      data: { valid: false, reason: 'Roman numeral cannot include whitespace' },
    });

    await expect(validate('ix')).resolves.toMatchObject({
      status: 200,
      data: { valid: false, reason: 'Roman numeral must use uppercase letters' },
    });

    await expect(validate('ABC')).resolves.toMatchObject({
      status: 200,
      data: { valid: false, reason: 'Roman numeral contains invalid characters' },
    });

    await expect(validate(42)).resolves.toMatchObject({
      status: 200,
      data: { valid: false, reason: 'Roman numeral must be a string' },
    });
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/routesF/roman-numeral-validator', {
      method: 'POST',
      body: '{',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid JSON body' });
  });
});
