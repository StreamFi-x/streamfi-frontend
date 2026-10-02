import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { text?: unknown; now?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const textInput = body.text;
  const nowInput = body.now;

  if (typeof textInput !== "string") {
    return NextResponse.json(
      { error: "text must be a string" },
      { status: 400 }
    );
  }

  const text = textInput.trim().toLowerCase();
  if (!text) {
    return NextResponse.json(
      { error: "text cannot be empty" },
      { status: 400 }
    );
  }

  let baseDate = new Date();
  if (nowInput !== undefined && nowInput !== null) {
    if (typeof nowInput !== "string") {
      return NextResponse.json(
        { error: "now must be a valid ISO string" },
        { status: 400 }
      );
    }
    baseDate = new Date(nowInput);
    if (isNaN(baseDate.getTime())) {
      return NextResponse.json(
        { error: "now is not a valid date string" },
        { status: 400 }
      );
    }
  }

  let resolvedDate: Date | null = null;
  let matchedRule: string | null = null;

  if (text === "tomorrow") {
    resolvedDate = new Date(baseDate);
    resolvedDate.setDate(resolvedDate.getDate() + 1);
    matchedRule = "tomorrow";
  } else if (text === "yesterday") {
    resolvedDate = new Date(baseDate);
    resolvedDate.setDate(resolvedDate.getDate() - 1);
    matchedRule = "yesterday";
  } else if (text === "next monday") {
    resolvedDate = new Date(baseDate);
    const day = resolvedDate.getDay();
    const daysToAdd = (1 - day + 7) % 7 || 7;
    resolvedDate.setDate(resolvedDate.getDate() + daysToAdd);
    matchedRule = "next monday";
  } else {
    // Check for "in X days" or "in X weeks"
    const inRegex = /^in\s+(\d+)\s+(day|week)s?$/i;
    const inMatch = text.match(inRegex);
    if (inMatch) {
      const amount = parseInt(inMatch[1], 10);
      const unit = inMatch[2].toLowerCase();
      resolvedDate = new Date(baseDate);
      if (unit === "day") {
        resolvedDate.setDate(resolvedDate.getDate() + amount);
      } else if (unit === "week") {
        resolvedDate.setDate(resolvedDate.getDate() + amount * 7);
      }
      matchedRule = textInput;
    }

    // Check for "X weeks ago" or "X days ago"
    const agoRegex = /^(\d+)\s+(day|week)s?\s+ago$/i;
    const agoMatch = text.match(agoRegex);
    if (agoMatch) {
      const amount = parseInt(agoMatch[1], 10);
      const unit = agoMatch[2].toLowerCase();
      resolvedDate = new Date(baseDate);
      if (unit === "day") {
        resolvedDate.setDate(resolvedDate.getDate() - amount);
      } else if (unit === "week") {
        resolvedDate.setDate(resolvedDate.getDate() - amount * 7);
      }
      matchedRule = textInput;
    }
  }

  if (!resolvedDate || !matchedRule) {
    return NextResponse.json(
      { error: `Unable to parse relative date: "${textInput}"` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    resolved: resolvedDate.toISOString(),
    matched: matchedRule,
  });
}
