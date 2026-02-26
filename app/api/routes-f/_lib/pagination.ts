export type CursorPayload = {
  value: string | number;
  id: string;
};

export type SortDirection = "asc" | "desc";

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<CursorPayload>;

    if (
      !parsed ||
      (typeof parsed.value !== "string" && typeof parsed.value !== "number") ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      return null;
    }

    return { value: parsed.value, id: parsed.id };
  } catch {
    return null;
  }
}

export function enforceLimit(
  limit: number | undefined,
  options?: { min?: number; max?: number; fallback?: number }
): number {
  const min = options?.min ?? 1;
  const max = options?.max ?? 50;
  const fallback = options?.fallback ?? 20;

  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return fallback;
  }

  const normalized = Math.trunc(limit);
  if (normalized < min) {
    return min;
  }
  if (normalized > max) {
    return max;
  }

  return normalized;
}

function comparePrimitive(
  left: string | number,
  right: string | number,
  direction: SortDirection
): number {
  if (left === right) {
    return 0;
  }

  if (direction === "asc") {
    return left < right ? -1 : 1;
  }

  return left > right ? -1 : 1;
}

export function stableSortBy<T>(
  items: T[],
  getSortValue: (item: T) => string | number,
  getId: (item: T) => string,
  direction: SortDirection = "desc"
): T[] {
  return [...items].sort((a, b) => {
    const valueCompare = comparePrimitive(
      getSortValue(a),
      getSortValue(b),
      direction
    );

    if (valueCompare !== 0) {
      return valueCompare;
    }

    // Deterministic tie-breaker for pagination stability.
    const idA = getId(a);
    const idB = getId(b);
    if (idA === idB) {
      return 0;
    }
    return idA < idB ? -1 : 1;
  });
}
