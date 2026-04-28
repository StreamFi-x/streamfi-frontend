export function recursivelySortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => recursivelySortKeys(entry));
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const sortedKeys = Object.keys(objectValue).sort((a, b) =>
      a.localeCompare(b)
    );
    const sorted: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      sorted[key] = recursivelySortKeys(objectValue[key]);
    }
    return sorted;
  }

  return value;
}

export function getLineColumnFromPosition(input: string, position: number) {
  const clamped = Math.max(0, Math.min(position, input.length));
  let line = 1;
  let column = 1;

  for (let i = 0; i < clamped; i++) {
    if (input[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

export function buildContextSnippet(input: string, position: number) {
  const start = Math.max(0, position - 25);
  const end = Math.min(input.length, position + 25);
  return input.slice(start, end);
}

export function extractErrorPosition(errorMessage: string): number | null {
  const match = errorMessage.match(/position\s+(\d+)/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}
