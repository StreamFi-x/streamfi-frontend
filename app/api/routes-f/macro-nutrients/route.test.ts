import { POST } from './route';

describe('macro-nutrients route', () => {
  it('calculates macros for male sedentary maintain', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        weight_kg: 70,
        height_cm: 175,
        age: 30,
        sex: 'male',
        activity_level: 'sedentary',
        goal: 'maintain'
      })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.bmr).toBeDefined();
    expect(data.tdee).toBeDefined();
    expect(data.target_calories).toBeDefined();
    expect(data.macros).toBeDefined();
  });

  it('calculates macros for female active lose', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        weight_kg: 60,
        height_cm: 160,
        age: 25,
        sex: 'female',
        activity_level: 'active',
        goal: 'lose'
      })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.target_calories).toBeLessThan(data.tdee); // because goal is lose
  });

  it('calculates macros for male very_active gain', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        weight_kg: 80,
        height_cm: 180,
        age: 22,
        sex: 'male',
        activity_level: 'very_active',
        goal: 'gain'
      })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.target_calories).toBeGreaterThan(data.tdee); // because goal is gain
  });
});
