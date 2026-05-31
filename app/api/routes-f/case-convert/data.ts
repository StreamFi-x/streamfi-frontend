export type CaseTarget =
  | "camelCase"
  | "snake_case"
  | "kebab-case"
  | "PascalCase"
  | "CONSTANT_CASE"
  | "Title Case"
  | "Sentence case";

export const VALID_TARGETS: CaseTarget[] = [
  "camelCase",
  "snake_case",
  "kebab-case",
  "PascalCase",
  "CONSTANT_CASE",
  "Title Case",
  "Sentence case",
];

function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toCamel(words: string[]): string {
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

function toSnake(words: string[]): string {
  return words.map((w) => w.toLowerCase()).join("_");
}

function toKebab(words: string[]): string {
  return words.map((w) => w.toLowerCase()).join("-");
}

function toPascal(words: string[]): string {
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function toConstant(words: string[]): string {
  return words.map((w) => w.toUpperCase()).join("_");
}

function toTitle(words: string[]): string {
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function toSentence(words: string[]): string {
  const result = words.map((w) => w.toLowerCase()).join(" ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function convertCase(
  text: string,
  target?: string
): Record<string, string> | { result: string } {
  const words = tokenize(text);

  if (target !== undefined) {
    switch (target as CaseTarget) {
      case "camelCase":
        return { result: toCamel(words) };
      case "snake_case":
        return { result: toSnake(words) };
      case "kebab-case":
        return { result: toKebab(words) };
      case "PascalCase":
        return { result: toPascal(words) };
      case "CONSTANT_CASE":
        return { result: toConstant(words) };
      case "Title Case":
        return { result: toTitle(words) };
      case "Sentence case":
        return { result: toSentence(words) };
      default:
        throw new Error("Invalid target case");
    }
  }

  return {
    camelCase: toCamel(words),
    snake_case: toSnake(words),
    "kebab-case": toKebab(words),
    PascalCase: toPascal(words),
    CONSTANT_CASE: toConstant(words),
    "Title Case": toTitle(words),
    "Sentence case": toSentence(words),
  };
}
