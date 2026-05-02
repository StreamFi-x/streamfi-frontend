import { NextRequest, NextResponse } from "next/server";

type RedactType = "email" | "phone" | "ssn" | "card" | "ip";

type FoundItem = {
  type: RedactType;
  position: number;
  length: number;
};

type RedactRequest = {
  text?: unknown;
  types?: unknown;
  replacement?: unknown;
};

const ONE_MB = 1024 * 1024;
const ALL_TYPES: RedactType[] = ["email", "phone", "ssn", "card", "ip"];

function isRedactType(value: unknown): value is RedactType {
  return (
    value === "email" ||
    value === "phone" ||
    value === "ssn" ||
    value === "card" ||
    value === "ip"
  );
}

function luhnCheck(number: string): boolean {
  if (!/^\d{13,19}$/.test(number)) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function collectMatches(text: string, types: RedactType[]): FoundItem[] {
  const found: FoundItem[] = [];

  if (types.includes("email")) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    for (const match of text.matchAll(emailRegex)) {
      if (typeof match.index !== "number") continue;
      found.push({ type: "email", position: match.index, length: match[0].length });
    }
  }

  if (types.includes("phone")) {
    const phoneRegex = /(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){1}\d{3}[\s.-]?\d{4}(?!\w)/g;
    for (const match of text.matchAll(phoneRegex)) {
      if (typeof match.index !== "number") continue;
      found.push({ type: "phone", position: match.index, length: match[0].length });
    }
  }

  if (types.includes("ssn")) {
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    for (const match of text.matchAll(ssnRegex)) {
      if (typeof match.index !== "number") continue;
      found.push({ type: "ssn", position: match.index, length: match[0].length });
    }
  }

  if (types.includes("ip")) {
    const ipRegex = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
    for (const match of text.matchAll(ipRegex)) {
      if (typeof match.index !== "number") continue;
      found.push({ type: "ip", position: match.index, length: match[0].length });
    }
  }

  if (types.includes("card")) {
    const cardRegex = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
    for (const match of text.matchAll(cardRegex)) {
      if (typeof match.index !== "number") continue;
      const digitsOnly = match[0].replace(/\D/g, "");
      if (!luhnCheck(digitsOnly)) continue;
      found.push({ type: "card", position: match.index, length: match[0].length });
    }
  }

  found.sort((a, b) => a.position - b.position || b.length - a.length);
  return found;
}

function redactText(text: string, found: FoundItem[], replacement: string): string {
  if (found.length === 0) return text;

  let redacted = "";
  let cursor = 0;

  for (const item of found) {
    if (item.position < cursor) continue;
    redacted += text.slice(cursor, item.position);
    redacted += replacement;
    cursor = item.position + item.length;
  }

  redacted += text.slice(cursor);
  return redacted;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: RedactRequest;

  try {
    body = (await request.json()) as RedactRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.text !== "string") {
    return NextResponse.json(
      { error: '"text" is required and must be a string' },
      { status: 400 }
    );
  }

  if (body.text.length > ONE_MB) {
    return NextResponse.json(
      { error: "Input text exceeds 1MB limit" },
      { status: 400 }
    );
  }

  const replacement =
    typeof body.replacement === "string" && body.replacement.length > 0
      ? body.replacement
      : "[REDACTED]";

  let types: RedactType[] = ALL_TYPES;
  if (body.types !== undefined) {
    if (!Array.isArray(body.types) || !body.types.every(isRedactType)) {
      return NextResponse.json(
        { error: '"types" must be an array of: email, phone, ssn, card, ip' },
        { status: 400 }
      );
    }
    types = body.types.length > 0 ? body.types : ALL_TYPES;
  }

  const found = collectMatches(body.text, types);
  const redacted = redactText(body.text, found, replacement);

  return NextResponse.json({ redacted, found }, { status: 200 });
}
