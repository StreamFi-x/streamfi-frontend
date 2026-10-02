// #886 feat(routesF): metaphone phonetic encoder

const VOWELS = "AEIOU";
const FRONTV = "EIY";
const VARSON = "CSPTG";

function isVowel(chars: string[], index: number): boolean {
  return index >= 0 && index < chars.length && VOWELS.includes(chars[index]);
}

function isLastChar(length: number, index: number): boolean {
  return index + 1 === length;
}

function isNextChar(chars: string[], index: number, c: string): boolean {
  return index >= 0 && index < chars.length - 1 && chars[index + 1] === c;
}

function isPreviousChar(chars: string[], index: number, c: string): boolean {
  return index > 0 && index < chars.length && chars[index - 1] === c;
}

function regionMatch(chars: string[], index: number, test: string): boolean {
  if (index < 0 || index + test.length > chars.length) {
    return false;
  }
  return chars.slice(index, index + test.length).join("") === test;
}

/**
 * Apply Metaphone initial-character normalization (KN, GN, WR, WH, etc.).
 */
function normalizeInitials(input: string): string[] {
  const upper = input.toUpperCase().replace(/[^A-Z]/g, "");
  if (upper.length === 0) {
    return [];
  }

  const chars = upper.split("");

  switch (chars[0]) {
    case "K":
    case "G":
    case "P":
      if (chars[1] === "N") {
        return chars.slice(1);
      }
      return chars;
    case "A":
      if (chars[1] === "E") {
        return chars.slice(1);
      }
      return chars;
    case "W":
      if (chars[1] === "R") {
        return chars.slice(1);
      }
      if (chars[1] === "H") {
        const result = chars.slice(1);
        result[0] = "W";
        return result;
      }
      return chars;
    case "X":
      chars[0] = "S";
      return chars;
    default:
      return chars;
  }
}

/**
 * Encode a single word using the Apache Commons Metaphone algorithm (max 4 chars).
 */
export function metaphone(word: string, maxCodeLen = 4): string {
  const local = normalizeInitials(word);
  if (local.length === 0) {
    return "";
  }
  if (local.length === 1) {
    return local[0];
  }

  const code: string[] = [];
  let hard = false;
  let index = 0;
  const length = local.length;

  while (code.length < maxCodeLen && index < length) {
    const symb = local[index];

    if (symb === "C" || !isPreviousChar(local, index, symb)) {
      switch (symb) {
        case "A":
        case "E":
        case "I":
        case "O":
        case "U":
          if (index === 0) {
            code.push(symb);
          }
          break;
        case "B":
          if (!(isPreviousChar(local, index, "M") && isLastChar(length, index))) {
            code.push(symb);
          }
          break;
        case "C":
          if (
            isPreviousChar(local, index, "S") &&
            !isLastChar(length, index) &&
            FRONTV.includes(local[index + 1])
          ) {
            break;
          }
          if (isPreviousChar(local, index, "S") && isNextChar(local, index, "H")) {
            code.push("K");
            break;
          }
          if (regionMatch(local, index, "CIA") || isNextChar(local, index, "H")) {
            code.push("X");
            break;
          }
          if (!isLastChar(length, index) && FRONTV.includes(local[index + 1])) {
            code.push("S");
            break;
          }
          code.push("K");
          break;
        case "D":
          if (
            !isLastChar(length, index + 1) &&
            isNextChar(local, index, "G") &&
            FRONTV.includes(local[index + 2])
          ) {
            code.push("J");
            index += 2;
          } else {
            code.push("T");
          }
          break;
        case "G":
          if (isLastChar(length, index + 1) && isNextChar(local, index, "H")) {
            break;
          }
          if (
            !isLastChar(length, index + 1) &&
            isNextChar(local, index, "H") &&
            !isVowel(local, index + 2)
          ) {
            break;
          }
          if (index > 0 && (regionMatch(local, index, "GN") || regionMatch(local, index, "GNED"))) {
            break;
          }
          hard = isPreviousChar(local, index, "G");
          if (!isLastChar(length, index) && FRONTV.includes(local[index + 1]) && !hard) {
            code.push("J");
          } else {
            code.push("K");
          }
          break;
        case "H":
          if (isLastChar(length, index)) {
            break;
          }
          if (index > 0 && VARSON.includes(local[index - 1])) {
            break;
          }
          if (isVowel(local, index + 1)) {
            code.push("H");
          }
          break;
        case "F":
        case "J":
        case "L":
        case "M":
        case "N":
        case "R":
          code.push(symb);
          break;
        case "K":
          if (index > 0) {
            if (!isPreviousChar(local, index, "C")) {
              code.push(symb);
            }
          } else {
            code.push(symb);
          }
          break;
        case "P":
          if (isNextChar(local, index, "H")) {
            code.push("F");
          } else {
            code.push(symb);
          }
          break;
        case "Q":
          code.push("K");
          break;
        case "S":
          if (
            regionMatch(local, index, "SH") ||
            regionMatch(local, index, "SIO") ||
            regionMatch(local, index, "SIA")
          ) {
            code.push("X");
          } else {
            code.push("S");
          }
          break;
        case "T":
          if (regionMatch(local, index, "TIA") || regionMatch(local, index, "TIO")) {
            code.push("X");
            break;
          }
          if (regionMatch(local, index, "TCH")) {
            break;
          }
          if (regionMatch(local, index, "TH")) {
            code.push("0");
          } else {
            code.push("T");
          }
          break;
        case "V":
          code.push("F");
          break;
        case "W":
        case "Y":
          if (!isLastChar(length, index) && isVowel(local, index + 1)) {
            code.push(symb);
          }
          break;
        case "X":
          code.push("K");
          code.push("S");
          break;
        case "Z":
          code.push("S");
          break;
        default:
          break;
      }
    }

    index += 1;
    if (code.length > maxCodeLen) {
      code.length = maxCodeLen;
    }
  }

  return code.join("");
}

export function encodeMetaphoneWords(words: string[]): string[] {
  return words.map((word) => metaphone(word));
}
