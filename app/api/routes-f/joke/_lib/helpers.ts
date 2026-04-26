import jokes from "./jokes.json";
import type { Joke, JokeCategory, JokeResponse } from "./types";

const allJokes = jokes as Joke[];

export function pickRandom(pool: Joke[]): Joke | null {
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function formatJoke(joke: Joke): JokeResponse["joke"] {
  return {
    id: joke.id,
    setup: joke.setup ?? joke.oneliner ?? null,
    punchline: joke.punchline ?? null,
    category: joke.category,
  };
}

export function getFiltered(category?: string, seen?: number[]): Joke[] {
  let pool = allJokes;
  if (category) {
    pool = pool.filter((j) => j.category === (category as JokeCategory));
  }
  if (seen?.length) {
    pool = pool.filter((j) => !seen.includes(j.id));
  }
  return pool;
}

export { allJokes };
