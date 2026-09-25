import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

// Minimal JSON-schema subset validator (no ajv): supports type, required,
// properties, minimum/maximum, minLength/maxLength, enum.

export interface SchemaError {
  path: string;
  message: string;
}

type JsonSchema = Record<string, unknown>;

function typeOf(v: unknown): string {
  if (v === null) {return "null";}
  if (Array.isArray(v)) {return "array";}
  return typeof v;
}

const join = (path: string, key: string) => (path ? `${path}.${key}` : key);

function walk(schema: JsonSchema, data: unknown, path: string, errors: SchemaError[]): void {
  if (typeof schema !== "object" || schema === null) {return;}

  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    const actual = typeOf(data);
    const ok = expected.some((t) =>
      t === "integer" ? actual === "number" && Number.isInteger(data) : t === actual,
    );
    if (!ok) {
      errors.push({ path, message: `expected type ${expected.join(" | ")}, got ${actual}` });
      return; // further keyword checks are meaningless on a type mismatch
    }
  }

  if (Array.isArray(schema.enum)) {
    const match = (schema.enum as unknown[]).some(
      (e) => JSON.stringify(e) === JSON.stringify(data),
    );
    if (!match) {errors.push({ path, message: "value is not one of the allowed enum values" });}
  }

  if (typeof data === "number") {
    if (typeof schema.minimum === "number" && data < schema.minimum) {
      errors.push({ path, message: `must be >= ${schema.minimum}` });
    }
    if (typeof schema.maximum === "number" && data > schema.maximum) {
      errors.push({ path, message: `must be <= ${schema.maximum}` });
    }
  }

  if (typeof data === "string") {
    if (typeof schema.minLength === "number" && data.length < schema.minLength) {
      errors.push({ path, message: `length must be >= ${schema.minLength}` });
    }
    if (typeof schema.maxLength === "number" && data.length > schema.maxLength) {
      errors.push({ path, message: `length must be <= ${schema.maxLength}` });
    }
  }

  if (typeOf(data) === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(schema.required)) {
      for (const key of schema.required as string[]) {
        if (!(key in obj)) {errors.push({ path: join(path, key), message: "required property is missing" });}
      }
    }
    if (schema.properties && typeof schema.properties === "object") {
      for (const [key, sub] of Object.entries(schema.properties as Record<string, JsonSchema>)) {
        if (key in obj) {walk(sub, obj[key], join(path, key), errors);}
      }
    }
  }
}

export function validateAgainstSchema(
  schema: JsonSchema,
  data: unknown,
): { valid: boolean; errors: SchemaError[] } {
  const errors: SchemaError[] = [];
  walk(schema, data, "", errors);
  return { valid: errors.length === 0, errors };
}

const schema = z.object({
  schema: z.record(z.any()),
  data: z.any(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) {return result;}
  const { schema: jsonSchema, data } = result.data;
  return NextResponse.json(validateAgainstSchema(jsonSchema as JsonSchema, data));
}
