import { NextResponse } from "next/server";

type StringField = {
  type: "string";
  optional?: boolean;
  minLength?: number;
  maxLength?: number;
  enum?: readonly string[];
};

type NumberField = {
  type: "number";
  optional?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
};

type BooleanField = {
  type: "boolean";
  optional?: boolean;
};

type Field = StringField | NumberField | BooleanField;
type Schema = Record<string, Field>;

type FieldOutput<T extends Field> = T extends StringField
  ? string
  : T extends NumberField
    ? number
    : T extends BooleanField
      ? boolean
      : never;

type RequiredKeys<S extends Schema> = {
  [K in keyof S]: S[K]["optional"] extends true ? never : K;
}[keyof S];

type OptionalKeys<S extends Schema> = {
  [K in keyof S]: S[K]["optional"] extends true ? K : never;
}[keyof S];

export type InferSchema<S extends Schema> = {
  [K in RequiredKeys<S>]: FieldOutput<S[K]>;
} & {
  [K in OptionalKeys<S>]?: FieldOutput<S[K]>;
};

export const defineSchema = <S extends Schema>(schema: S) => schema;

type ParseSuccess<T> = { ok: true; data: T };
type ParseFailure = {
  ok: false;
  error: { message: string; details?: string[] };
};

export function validatePayload<S extends Schema>(
  value: unknown,
  schema: S
): ParseSuccess<InferSchema<S>> | ParseFailure {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error: { message: "Request body must be a JSON object" },
    };
  }

  const input = value as Record<string, unknown>;
  const errors: string[] = [];
  const output: Record<string, unknown> = {};

  for (const key of Object.keys(input)) {
    if (!(key in schema)) {
      errors.push(`Unknown field: ${key}`);
    }
  }

  for (const key of Object.keys(schema)) {
    const rule = schema[key];
    const raw = input[key];

    if (raw === undefined) {
      if (!rule.optional) {
        errors.push(`Missing required field: ${key}`);
      }
      continue;
    }

    if (rule.type === "string") {
      if (typeof raw !== "string") {
        errors.push(`Field "${key}" must be a string`);
        continue;
      }
      if (rule.minLength !== undefined && raw.length < rule.minLength) {
        errors.push(`Field "${key}" must have at least ${rule.minLength} characters`);
      }
      if (rule.maxLength !== undefined && raw.length > rule.maxLength) {
        errors.push(`Field "${key}" must have at most ${rule.maxLength} characters`);
      }
      if (rule.enum && !rule.enum.includes(raw)) {
        errors.push(`Field "${key}" must be one of: ${rule.enum.join(", ")}`);
      }
      output[key] = raw;
      continue;
    }

    if (rule.type === "number") {
      if (typeof raw !== "number" || Number.isNaN(raw)) {
        errors.push(`Field "${key}" must be a number`);
        continue;
      }
      if (rule.integer && !Number.isInteger(raw)) {
        errors.push(`Field "${key}" must be an integer`);
      }
      if (rule.min !== undefined && raw < rule.min) {
        errors.push(`Field "${key}" must be >= ${rule.min}`);
      }
      if (rule.max !== undefined && raw > rule.max) {
        errors.push(`Field "${key}" must be <= ${rule.max}`);
      }
      output[key] = raw;
      continue;
    }

    if (typeof raw !== "boolean") {
      errors.push(`Field "${key}" must be a boolean`);
      continue;
    }
    output[key] = raw;
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: { message: "Invalid request payload", details: errors },
    };
  }

  return { ok: true, data: output as InferSchema<S> };
}

export async function parseRequestBody<S extends Schema>(
  request: Request,
  schema: S
): Promise<
  | { ok: true; data: InferSchema<S> }
  | { ok: false; response: Response }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const parsed = validatePayload(body, schema);
  if (parsed.ok === false) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: parsed.error.message, details: parsed.error.details ?? [] },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
