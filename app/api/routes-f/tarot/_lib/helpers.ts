import { TAROT_DECK, SPREAD_POSITIONS } from "./deck";

interface TarotCard {
  position: string;
  name: string;
  suit: string;
  orientation: "upright" | "reversed";
  meaning: string;
}

interface TarotDrawInput {
  count: number;
  spread: "single" | "three-card" | "celtic-cross";
  seed?: string;
}

interface TarotDrawResult {
  spread: string;
  cards: TarotCard[];
}

class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    this.seed = this.hashSeed(seed);
  }

  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export function drawTarotCards(input: TarotDrawInput): TarotDrawResult {
  const { count, spread, seed } = input;
  
  // Determine actual number of cards needed based on spread
  const cardsNeeded = spread === "single" ? 1 : spread === "three-card" ? 3 : 10;
  const actualCount = Math.min(count, cardsNeeded);
  
  // Create random generator (seeded if provided)
  const random = seed ? new SeededRandom(seed) : null;
  
  // Shuffle deck
  const shuffledDeck = random ? random.shuffle(TAROT_DECK) : shuffleDeck([...TAROT_DECK]);
  
  // Draw cards
  const drawnCards: TarotCard[] = [];
  const positions = SPREAD_POSITIONS[spread];
  
  for (let i = 0; i < actualCount; i++) {
    const card = shuffledDeck[i];
    const orientation = random ? 
      (random.next() < 0.5 ? "upright" as const : "reversed" as const) :
      (Math.random() < 0.5 ? "upright" as const : "reversed" as const);
    
    const meaning = orientation === "upright" ? card.upright : card.reversed;
    
    drawnCards.push({
      position: positions[i] || `Position ${i + 1}`,
      name: card.name,
      suit: card.suit,
      orientation,
      meaning,
    });
  }
  
  return {
    spread,
    cards: drawnCards,
  };
}

function shuffleDeck<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
