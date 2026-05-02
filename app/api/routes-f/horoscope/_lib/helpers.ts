import { ZODIAC_SIGNS, READINGS, LUCKY_COLORS, MOODS } from './data';

export function generateHoroscope(sign: string, date: string) {
  // Validate zodiac sign
  const normalizedSign = sign.toLowerCase().trim();
  if (!ZODIAC_SIGNS.includes(normalizedSign)) {
    throw new Error(`Invalid zodiac sign. Must be one of: ${ZODIAC_SIGNS.join(', ')}`);
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error('Invalid date format. Must be YYYY-MM-DD');
  }

  // Create deterministic seed from sign and date
  const seed = createSeed(normalizedSign, date);
  
  // Use seed to deterministically select values
  const readings = READINGS[normalizedSign as keyof typeof READINGS];
  const readingIndex = seededRandom(seed, 0, readings.length - 1);
  const reading = readings[readingIndex];
  
  const luckyNumber = seededRandom(seed + 1, 1, 100);
  const luckyColorIndex = seededRandom(seed + 2, 0, LUCKY_COLORS.length - 1);
  const luckyColor = LUCKY_COLORS[luckyColorIndex];
  const moodIndex = seededRandom(seed + 3, 0, MOODS.length - 1);
  const mood = MOODS[moodIndex];

  return {
    sign: normalizedSign,
    date,
    reading,
    lucky_number: luckyNumber,
    lucky_color: luckyColor,
    mood
  };
}

function createSeed(sign: string, date: string): number {
  // Create a simple hash from sign and date for determinism
  const combined = sign + date;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, min: number, max: number): number {
  // Simple deterministic pseudo-random number generator
  const x = Math.sin(seed) * 10000;
  const random = x - Math.floor(x);
  return Math.floor(random * (max - min + 1)) + min;
}
