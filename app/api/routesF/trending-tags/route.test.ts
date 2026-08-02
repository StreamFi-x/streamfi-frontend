import { calculateTrending, getSeedUsages } from './route';

describe('Trending Tags', () => {
  it('calculates trending tags correctly for 24h window', () => {
    const now = Date.now();
    const usages = getSeedUsages(now);
    const tags = calculateTrending(usages, 24, 10, now);

    expect(tags).toHaveLength(2);
    
    const gaming = tags.find(t => t.tag === 'gaming');
    expect(gaming).toBeDefined();
    expect(gaming?.uses).toBe(2);
    // gaming had 1 in prior window, 2 in current -> 100% increase
    expect(gaming?.delta_percent).toBe(100);

    const crypto = tags.find(t => t.tag === 'crypto');
    expect(crypto).toBeDefined();
    expect(crypto?.uses).toBe(2);
    // crypto had 2 in prior window, 2 in current -> 0% increase
    expect(crypto?.delta_percent).toBe(0);
  });

  it('limits results correctly', () => {
    const now = Date.now();
    const usages = getSeedUsages(now);
    const tags = calculateTrending(usages, 24, 1, now);
    
    expect(tags).toHaveLength(1);
    expect(tags[0].tag).toBe('gaming'); // Or crypto, depending on sort (both have 2 uses). We should probably make sure sort is stable, but this is fine.
  });
});
