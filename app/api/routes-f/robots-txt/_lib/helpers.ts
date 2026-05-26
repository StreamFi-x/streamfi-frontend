import type { RobotsRule } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty.`);
  }

  return trimmed;
}

function normalizePathList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of strings.`);
  }

  return value.map((item, index) => normalizeString(item, `${field}[${index}]`));
}

function normalizeRule(value: unknown, index: number): RobotsRule {
  if (!isRecord(value)) {
    throw new Error(`rules[${index}] must be an object.`);
  }

  return {
    user_agent: normalizeString(value.user_agent, `rules[${index}].user_agent`),
    allow: normalizePathList(value.allow, `rules[${index}].allow`),
    disallow: normalizePathList(value.disallow, `rules[${index}].disallow`),
  };
}

export function buildRobotsTxt(input: unknown): string {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  if (!Array.isArray(input.rules) || input.rules.length === 0) {
    throw new Error("rules must contain at least one rule.");
  }

  const rules = input.rules.map(normalizeRule);
  const sections = rules.map((rule) => {
    const lines = [`User-agent: ${rule.user_agent}`];

    for (const path of rule.allow ?? []) {
      lines.push(`Allow: ${path}`);
    }

    for (const path of rule.disallow ?? []) {
      lines.push(`Disallow: ${path}`);
    }

    return lines.join("\n");
  });

  if (input.sitemap !== undefined) {
    sections.push(`Sitemap: ${normalizeString(input.sitemap, "sitemap")}`);
  }

  return `${sections.join("\n\n")}\n`;
}
