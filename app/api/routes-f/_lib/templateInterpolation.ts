export type MissingMode = "empty" | "keep" | "error";

export type InterpolationResult = {
  output: string;
  missing_keys: string[];
};

function resolveValue(values: unknown, path: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current = values;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }

    if (Array.isArray(current)) {
      current = (current as any)[segment];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

export function interpolateTemplate(
  template: string,
  values: unknown,
  onMissing: MissingMode = "empty"
): InterpolationResult {
  const missingKeys = new Set<string>();

  const output = template.replace(/{{\s*([^}]+?)\s*}}/g, (match, path) => {
    const key = String(path).trim();
    const resolved = resolveValue(values, key);

    if (resolved === undefined || resolved === null) {
      missingKeys.add(key);
      return onMissing === "keep" ? match : "";
    }

    if (typeof resolved === "string") {
      return resolved;
    }

    if (typeof resolved === "number" || typeof resolved === "boolean") {
      return String(resolved);
    }

    return JSON.stringify(resolved);
  });

  return {
    output,
    missing_keys: Array.from(missingKeys),
  };
}
