export type Mode = "count" | "enumerate";
export type CombinatoricsType = "combination" | "permutation";

export const ENUMERATION_LIMIT = 10_000;

export type RequestBody = {
  mode?: unknown;
  n?: unknown;
  r?: unknown;
  type?: unknown;
  items?: unknown;
};

export function validateRequest(body: RequestBody):
  | {
      ok: true;
      mode: "count";
      n: number;
      r: number;
      type: CombinatoricsType;
    }
  | {
      ok: true;
      mode: "enumerate";
      n: number;
      r: number;
      type: CombinatoricsType;
      items: unknown[];
    }
  | { ok: false; error: string } {
  if (body.mode !== "count" && body.mode !== "enumerate") {
    return { ok: false, error: "mode must be count or enumerate" };
  }
  if (body.type !== "combination" && body.type !== "permutation") {
    return { ok: false, error: "type must be combination or permutation" };
  }
  if (!Number.isInteger(body.n) || (body.n as number) < 0) {
    return { ok: false, error: "n must be a non-negative integer" };
  }
  if (!Number.isInteger(body.r) || (body.r as number) < 0) {
    return { ok: false, error: "r must be a non-negative integer" };
  }
  if ((body.r as number) > (body.n as number)) {
    return { ok: false, error: "r must be less than or equal to n" };
  }

  if (body.mode === "enumerate") {
    if (!Array.isArray(body.items) || body.items.length !== body.n) {
      return {
        ok: false,
        error: "enumerate mode requires items array of length n",
      };
    }
    return {
      ok: true,
      mode: body.mode,
      n: body.n as number,
      r: body.r as number,
      type: body.type,
      items: body.items,
    };
  }

  return {
    ok: true,
    mode: body.mode,
    n: body.n as number,
    r: body.r as number,
    type: body.type,
  };
}

function factorialRange(high: number, lowExclusive: number): bigint {
  let value = 1n;
  for (let i = high; i > lowExclusive; i--) {
    value *= BigInt(i);
  }
  return value;
}

export function countCombinatorics(
  n: number,
  r: number,
  type: CombinatoricsType,
): bigint {
  if (type === "permutation") return factorialRange(n, n - r);

  const k = Math.min(r, n - r);
  let value = 1n;
  for (let i = 1; i <= k; i++) {
    value = (value * BigInt(n - k + i)) / BigInt(i);
  }
  return value;
}

export function enumerateCombinations(items: unknown[], r: number): unknown[][] {
  const results: unknown[][] = [];
  const selected: unknown[] = [];

  function visit(start: number) {
    if (results.length >= ENUMERATION_LIMIT) return;
    if (selected.length === r) {
      results.push([...selected]);
      return;
    }

    const needed = r - selected.length;
    for (let i = start; i <= items.length - needed; i++) {
      selected.push(items[i]);
      visit(i + 1);
      selected.pop();
      if (results.length >= ENUMERATION_LIMIT) return;
    }
  }

  visit(0);
  return results;
}

export function enumeratePermutations(items: unknown[], r: number): unknown[][] {
  const results: unknown[][] = [];
  const selected: unknown[] = [];
  const used = new Array(items.length).fill(false);

  function visit() {
    if (results.length >= ENUMERATION_LIMIT) return;
    if (selected.length === r) {
      results.push([...selected]);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      selected.push(items[i]);
      visit();
      selected.pop();
      used[i] = false;
      if (results.length >= ENUMERATION_LIMIT) return;
    }
  }

  visit();
  return results;
}
