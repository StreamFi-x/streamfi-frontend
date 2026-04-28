import { ParsedNotation } from './types';

// Seeded random number generator using Linear Congruential Generator
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Returns a random number between 0 (inclusive) and 1 (exclusive)
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  // Returns a random integer between min (inclusive) and max (inclusive)
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export function parseDiceNotation(notation: string): ParsedNotation {
  // Trim whitespace and convert to lowercase
  const cleanNotation = notation.trim().toLowerCase();
  
  // Basic pattern: XdY[+|-Z][kN|dlN]
  const dicePattern = /^(\d+)d(\d+)([+-]\d+)?(k\d+|dl\d+)?$/;
  const match = cleanNotation.match(dicePattern);
  
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  
  // Validate limits
  if (count > 100) {
    throw new Error('Maximum 100 dice per roll allowed');
  }
  if (sides > 1000) {
    throw new Error('Maximum 1000 sides per die allowed');
  }
  if (count < 1) {
    throw new Error('Must roll at least 1 die');
  }
  if (sides < 1) {
    throw new Error('Dice must have at least 1 side');
  }

  // Parse modifier
  let modifier = 0;
  if (match[3]) {
    modifier = parseInt(match[3], 10);
  }

  // Parse keep/drop modifiers
  let keepHighest: number | undefined;
  let dropLowest: number | undefined;
  
  if (match[4]) {
    if (match[4].startsWith('k')) {
      keepHighest = parseInt(match[4].substring(1), 10);
      if (keepHighest >= count) {
        throw new Error('Keep highest value must be less than total dice count');
      }
      if (keepHighest < 1) {
        throw new Error('Keep highest value must be at least 1');
      }
    } else if (match[4].startsWith('dl')) {
      dropLowest = parseInt(match[4].substring(2), 10);
      if (dropLowest >= count) {
        throw new Error('Drop lowest value must be less than total dice count');
      }
      if (dropLowest < 1) {
        throw new Error('Drop lowest value must be at least 1');
      }
    }
  }

  return {
    count,
    sides,
    modifier,
    keepHighest,
    dropLowest
  };
}

export function rollDice(parsed: ParsedNotation, seed?: number): {
  total: number;
  rolls: number[];
  dropped?: number[];
} {
  const rng = seed !== undefined ? new SeededRandom(seed) : null;
  
  // Roll all dice
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    const roll = rng 
      ? rng.nextInt(1, parsed.sides)
      : Math.floor(Math.random() * parsed.sides) + 1;
    rolls.push(roll);
  }

  // Sort rolls for keep/drop logic
  const sortedRolls = [...rolls].sort((a, b) => b - a);
  let keptRolls: number[];
  let droppedRolls: number[] | undefined;

  if (parsed.keepHighest !== undefined) {
    keptRolls = sortedRolls.slice(0, parsed.keepHighest);
    droppedRolls = sortedRolls.slice(parsed.keepHighest);
  } else if (parsed.dropLowest !== undefined) {
    keptRolls = sortedRolls.slice(0, sortedRolls.length - parsed.dropLowest);
    droppedRolls = sortedRolls.slice(sortedRolls.length - parsed.dropLowest);
  } else {
    keptRolls = rolls;
  }

  // Calculate total
  const total = keptRolls.reduce((sum, roll) => sum + roll, 0) + parsed.modifier;

  return {
    total,
    rolls: keptRolls,
    dropped: droppedRolls
  };
}
