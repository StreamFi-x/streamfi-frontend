import { RoutesFRecord as SchemaRecord } from "./schema";
import { sanitizeObject } from "./sanitizer";

const MAX_TAGS = 8;

export interface TransformedPayload {
  name: string;
  path: string;
  method: string;
  priority: number;
  enabled: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  slug: string;
  previewedAt: string;
}

/**
 * Transforms a validated Routes-F payload into a normalized preview
 * with computed fields.  Does **not** persist anything.
 */
export function transformRoutesFPayload(raw: SchemaRecord): TransformedPayload {
  const sanitized = sanitizeObject({ ...raw });

  const name = (sanitized.name ?? "").trim();
  const path = (sanitized.path ?? "").trim().toLowerCase();
  const method = (sanitized.method ?? "").toUpperCase();
  const priority =
    typeof sanitized.priority === "number" ? sanitized.priority : 0;
  const enabled =
    typeof sanitized.enabled === "boolean" ? sanitized.enabled : true;

  // De-duplicate, trim, lowercase, cap at MAX_TAGS
  const tags = Array.isArray(sanitized.tags)
    ? [
        ...new Set(
          sanitized.tags
            .filter((t): t is string => typeof t === "string")
            .map(t => t.trim().toLowerCase())
        ),
      ].slice(0, MAX_TAGS)
    : [];

  const metadata =
    sanitized.metadata && typeof sanitized.metadata === "object"
      ? (sanitized.metadata as Record<string, unknown>)
      : {};

  const slug = `${method}:${path}`;
  const previewedAt = new Date().toISOString();

  return {
    name,
    path,
    method,
    priority,
    enabled,
    tags,
    metadata,
    slug,
    previewedAt,
  };
}
