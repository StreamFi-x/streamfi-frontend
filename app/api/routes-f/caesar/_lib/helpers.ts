import { CaesarMode } from './types';

const ALPHABET_SIZE = 26;
const UPPER_A = 65;
const LOWER_A = 97;

// normalized shift to 0-25 range using modulo
export function normalizeShift(shift: number): number {
  return ((shift % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
}

function shiftChar(char: string, shift: number): string {
  const code = char.charCodeAt(0);

  // uppercase A-Z
  if (code >= UPPER_A && code <= 90) {
    return String.fromCharCode(UPPER_A + ((code - UPPER_A + shift) % ALPHABET_SIZE));
  }

  // lowercase a-z
  if (code >= LOWER_A && code <= 122) {
    return String.fromCharCode(LOWER_A + ((code - LOWER_A + shift) % ALPHABET_SIZE));
  }

  // non-alphabetic - preserve unchanged
  return char;
}

//  applying Caesar cipher to text
// For decode shift in the opposite direction
export function caesarCipher(text: string, shift: number, mode: CaesarMode): string {
  const effectiveShift = mode === 'decode' ? -shift : shift;
  const normalized = normalizeShift(effectiveShift);

  if (normalized === 0) {
    return text;
  }

  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += shiftChar(text[i], normalized);
  }

  return result;
}

// simple heuristic to detect if text appears to be english
//  checks for common english words and letter frequency patterns
export function isDetectablyEnglish(text: string): boolean {
  const lower = text.toLowerCase();

  // common short english words
  const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'her', 'way', 'many', 'oil', 'sit', 'set', 'run', 'eat', 'far', 'sea', 'eye', 'ago', 'off', 'too', 'any', 'say', 'man', 'try', 'ask', 'end', 'why', 'let', 'put', 'say', 'she', 'try', 'way', 'own', 'say', 'too', 'old', 'tell', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'over', 'such', 'take', 'than', 'them', 'well', 'were'];

  //checking for common words
  const words = lower.split(/[^a-z]+/).filter(w => w.length > 0);
  let commonWordCount = 0;
  for (const word of words) {
    if (commonWords.includes(word)) {
      commonWordCount++;
    }
  }

  // finding 2+ common words in a reasonably sized text, it's likely english
  if (words.length >= 3 && commonWordCount >= 2) {
    return true;
  }

  // checking for high frequency of common english letters
  const englishFreq = 'etaoinshrdlcumwfgypbvkjxqz';
  let freqScore = 0;
  const lettersOnly = lower.replace(/[^a-z]/g, '');
  if (lettersOnly.length === 0) return false;

  for (const char of lettersOnly) {
    const rank = englishFreq.indexOf(char);
    if (rank !== -1) {
      // higher score for more common letters
      freqScore += (26 - rank);
    }
  }

  const avgFreq = freqScore / lettersOnly.length;
  // english text typically has average letter frequency score > 14
  return avgFreq > 14 && lettersOnly.length > 10;
}

// built the response with optional warning for unchanged shift
export function buildResponse(
  result: string,
  shiftUsed: number,
  originalText: string,
  mode: CaesarMode
): { result: string; shift_used: number; warning?: string } {
  const normalizedShift = normalizeShift(shiftUsed);

  // warning if shift is effectively 0 and text is detectably english
  if (normalizedShift === 0 && mode === 'encode' && isDetectablyEnglish(originalText)) {
    return {
      result,
      shift_used: normalizedShift,
      warning: 'Shift value results in no transformation (shift % 26 === 0). Text appears to be English and will remain unchanged.',
    };
  }

  return {
    result,
    shift_used: normalizedShift,
  };
}