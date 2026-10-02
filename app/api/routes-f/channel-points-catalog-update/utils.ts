import type { CatalogUpdateBody, Reward } from "./types";

export const UPDATABLE_FIELDS = ["title", "cost", "cooldown", "stock"] as const;

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// Returns an error message when the update payload is invalid, or null when
// every supplied field is well-formed. At least one updatable field must be
// present — a PUT with nothing to change is treated as a bad request.
export function validateUpdateFields(
  body: Partial<CatalogUpdateBody>
): string | null {
  const supplied = UPDATABLE_FIELDS.filter(field => body[field] !== undefined);
  if (supplied.length === 0) {
    return `at least one of ${UPDATABLE_FIELDS.join(", ")} is required`;
  }

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return "title must be a non-empty string";
    }
  }
  if (body.cost !== undefined && !isPositiveInteger(body.cost)) {
    return "cost must be a positive integer";
  }
  if (body.cooldown !== undefined && !isNonNegativeInteger(body.cooldown)) {
    return "cooldown must be a non-negative integer";
  }
  if (
    body.stock !== undefined &&
    body.stock !== null &&
    !isNonNegativeInteger(body.stock)
  ) {
    return "stock must be a non-negative integer or null";
  }

  return null;
}

// Applies only the supplied updatable fields to a copy of the reward and stamps
// updated_at. Assumes the payload has already passed validateUpdateFields.
export function applyUpdate(
  reward: Reward,
  body: Partial<CatalogUpdateBody>
): Reward {
  const next: Reward = { ...reward };

  if (body.title !== undefined) {
    next.title = body.title.trim();
  }
  if (body.cost !== undefined) {
    next.cost = body.cost;
  }
  if (body.cooldown !== undefined) {
    next.cooldown = body.cooldown;
  }
  if (body.stock !== undefined) {
    next.stock = body.stock;
  }

  next.updated_at = new Date().toISOString();
  return next;
}
