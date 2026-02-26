export const ROUTES_F_ALLOWED_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;

export type RoutesFMethod = (typeof ROUTES_F_ALLOWED_METHODS)[number];

export type RoutesFRecord = {
  name: string;
  path: string;
  method: RoutesFMethod;
  priority?: number;
  enabled?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

const MAX_NAME_LENGTH = 100;
const MAX_PATH_LENGTH = 200;
const MAX_TAGS = 8;

export function validateRoutesFRecord(payload: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload || typeof payload !== "object") {
    return {
      isValid: false,
      errors: ["Payload must be an object"],
      warnings,
    };
  }

  const record = payload as Partial<RoutesFRecord>;

  if (!record.name || typeof record.name !== "string") {
    errors.push("name is required and must be a string");
  } else if (record.name.trim().length === 0) {
    errors.push("name cannot be empty");
  } else if (record.name.length > MAX_NAME_LENGTH) {
    errors.push(`name must be <= ${MAX_NAME_LENGTH} characters`);
  }

  if (!record.path || typeof record.path !== "string") {
    errors.push("path is required and must be a string");
  } else if (!record.path.startsWith("/")) {
    errors.push("path must start with '/'");
  } else if (record.path.length > MAX_PATH_LENGTH) {
    errors.push(`path must be <= ${MAX_PATH_LENGTH} characters`);
  }

  if (!record.method || typeof record.method !== "string") {
    errors.push("method is required and must be a string");
  } else if (!ROUTES_F_ALLOWED_METHODS.includes(record.method as RoutesFMethod)) {
    errors.push(
      `method must be one of: ${ROUTES_F_ALLOWED_METHODS.join(", ")}`
    );
  }

  if (record.priority !== undefined) {
    if (typeof record.priority !== "number" || Number.isNaN(record.priority)) {
      errors.push("priority must be a number");
    } else if (record.priority < 0 || record.priority > 100) {
      errors.push("priority must be between 0 and 100");
    }
  }

  if (record.enabled !== undefined && typeof record.enabled !== "boolean") {
    errors.push("enabled must be a boolean");
  }

  if (record.tags !== undefined) {
    if (!Array.isArray(record.tags)) {
      errors.push("tags must be an array of strings");
    } else {
      const invalidTags = record.tags.filter(tag => typeof tag !== "string");
      if (invalidTags.length > 0) {
        errors.push("tags must be an array of strings");
      }
      if (record.tags.length > MAX_TAGS) {
        warnings.push(`tags length exceeds ${MAX_TAGS}; extra tags ignored`);
      }
    }
  }

  if (record.metadata !== undefined) {
    if (typeof record.metadata !== "object" || Array.isArray(record.metadata)) {
      errors.push("metadata must be an object");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
