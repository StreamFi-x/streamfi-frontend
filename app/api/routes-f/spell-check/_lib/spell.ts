import fs from "node:fs";
import path from "node:path";

const DICTIONARY_PATH = path.join(
  process.cwd(),
  "app/api/routes-f/spell-check/_lib/dictionary.txt"
);

let dictionaryCache: Set<string> | null = null;
let dictionaryListCache: string[] | null = null;

export function getDictionary() {
  if (dictionaryCache && dictionaryListCache) {
    return {
      dictionary: dictionaryCache,
      dictionaryList: dictionaryListCache,
    };
  }

  const fileContent = fs.readFileSync(DICTIONARY_PATH, "utf8");
  const words = fileContent
    .split(/\r?\n/)
    .map(entry => entry.trim().toLowerCase())
    .filter(entry => entry.length >= 2);

  dictionaryCache = new Set(words);
  dictionaryListCache = words;

  return {
    dictionary: dictionaryCache,
    dictionaryList: dictionaryListCache,
  };
}

export function extractWordsWithPosition(text: string) {
  const matches = text.matchAll(/[A-Za-z]+/g);
  const words: Array<{ word: string; position: number }> = [];

  for (const match of matches) {
    const rawWord = match[0];
    const position = match.index ?? 0;
    words.push({ word: rawWord.toLowerCase(), position });
  }

  return words;
}

export function levenshteinWithinMax(
  source: string,
  target: string,
  maxDistance: number
) {
  if (source === target) return 0;
  if (Math.abs(source.length - target.length) > maxDistance) return null;

  const previous = Array.from({ length: target.length + 1 }, (_, i) => i);

  for (let i = 1; i <= source.length; i++) {
    const current = [i];
    let rowMin = current[0];

    for (let j = 1; j <= target.length; j++) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1;
      const nextValue = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
      current[j] = nextValue;
      if (nextValue < rowMin) rowMin = nextValue;
    }

    if (rowMin > maxDistance) return null;
    for (let j = 0; j < current.length; j++) previous[j] = current[j];
  }

  const distance = previous[target.length];
  return distance <= maxDistance ? distance : null;
}

export function getSuggestions(
  misspelledWord: string,
  dictionaryList: string[],
  maxSuggestions: number
) {
  const scored: Array<{ candidate: string; distance: number }> = [];

  for (const candidate of dictionaryList) {
    const distance = levenshteinWithinMax(misspelledWord, candidate, 2);
    if (distance !== null) {
      scored.push({ candidate, distance });
    }
  }

  scored.sort((left, right) => {
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    if (left.candidate.length !== right.candidate.length) {
      return (
        Math.abs(left.candidate.length - misspelledWord.length) -
        Math.abs(right.candidate.length - misspelledWord.length)
      );
    }
    return left.candidate.localeCompare(right.candidate);
  });

  return scored.slice(0, maxSuggestions).map(entry => entry.candidate);
}
