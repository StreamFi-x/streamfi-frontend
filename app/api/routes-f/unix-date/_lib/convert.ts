import type { UnixDateRequest, UnixDateResponse, UnixDateUnit } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeUnit(value: unknown): UnixDateUnit {
  if (value === undefined) {
    return "s";
  }

  if (value === "s" || value === "ms") {
    return value;
  }

  throw new Error("unit must be s or ms.");
}

function finiteNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("value must be a finite number.");
  }

  return value;
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error("value must be a valid ISO date or timestamp.");
  }
}

export function convertUnixDate(input: unknown): UnixDateResponse {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  // `input` is an arbitrary record here; its fields are validated below, so
  // assert through `unknown` rather than directly (the record type does not
  // structurally overlap with UnixDateRequest's required fields).
  const request = input as unknown as UnixDateRequest;
  const unit = normalizeUnit(request.unit);

  if (request.mode === "to_iso") {
    const timestamp = finiteNumber(request.value);
    const date = new Date(unit === "s" ? timestamp * 1000 : timestamp);

    assertValidDate(date);

    return {
      result: date.toISOString(),
      unit,
    };
  }

  if (request.mode === "to_unix") {
    if (typeof request.value !== "string") {
      throw new Error("value must be an ISO date string.");
    }

    const date = new Date(request.value);
    assertValidDate(date);

    const timestampMs = date.getTime();

    return {
      result: unit === "s" ? timestampMs / 1000 : timestampMs,
      unit,
    };
  }

  throw new Error("mode must be to_iso or to_unix.");
}
