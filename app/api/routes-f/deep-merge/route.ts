/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

type ArrayStrategy = "replace" | "concat" | "union";

const schema = z.object({
  objects: z.array(z.record(z.unknown())).min(1),
  array_strategy: z.enum(["replace", "concat", "union"]).optional().default("replace"),
});

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

export function deepMerge(
  objects: Record<string, unknown>[],
  arrayStrategy: ArrayStrategy
): Record<string, unknown> {
  if (objects.length === 0) {return {};}
  if (objects.length === 1) {return objects[0];}

  const result: Record<string, unknown> = {};

  for (const obj of objects) {
    for (const key in obj) {
      const val = obj[key];
      
      if (!(key in result)) {
        result[key] = val;
        continue;
      }

      const existing = result[key];

      if (Array.isArray(existing) && Array.isArray(val)) {
        if (arrayStrategy === "replace") {
          result[key] = val;
        } else if (arrayStrategy === "concat") {
          result[key] = existing.concat(val);
        } else if (arrayStrategy === "union") {
          result[key] = Array.from(new Set([...existing, ...val]));
        }
      } else if (isObject(existing) && isObject(val)) {
        result[key] = deepMerge([existing, val], arrayStrategy);
      } else {
        result[key] = val;
      }
    }
  }

  return result;
}

export async function POST(request: Request): Promise<NextResponse> {
  const bodyText = await request.text();
  
  if (bodyText.length > MAX_SIZE) {
    return NextResponse.json(
      { error: `Request body exceeds ${MAX_SIZE / 1024 / 1024}MB limit` },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { objects, array_strategy } = parsed.data;
  const merged = deepMerge(objects, array_strategy);

  return NextResponse.json({ merged });
}
