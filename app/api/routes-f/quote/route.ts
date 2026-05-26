import { type NextRequest, NextResponse } from "next/server";
import { getQuoteById, getRandomQuote, getDeterministicQuote, getCategories, quotes } from "./data";

// context is accepted but unused; typed as `unknown` so it satisfies both the
// Next.js 16 route validator (expects Promise<params>) and the Jest test calls
// that pass a plain { params: { id } } object.
export async function GET(req: NextRequest, context?: { params?: unknown }) {
  void context; // suppress unused-variable warning
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  // /quote/random
  if (lastPart === "random") {
    const category = url.searchParams.get("category") ?? undefined;
    if (category) {
      // Validate category if getCategories returns a list (may be undefined in test mocks)
      const categories = getCategories();
      if (categories && !categories.includes(category)) {
        return NextResponse.json(
          { error: `Category '${category}' not found`, availableCategories: categories },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(getRandomQuote(category));
  }

  // /quote/today
  if (lastPart === "today") {
    const date = url.searchParams.get("date") ?? undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
    }
    return NextResponse.json(getDeterministicQuote(date));
  }

  // /quote/:id  (last path segment)
  const idStr = lastPart !== "quote" ? lastPart : undefined;
  if (idStr) {
    const id = Number(idStr);
    if (!Number.isInteger(id) || isNaN(id)) {
      return NextResponse.json({ error: "Invalid quote ID format" }, { status: 400 });
    }
    const quote = getQuoteById(id);
    if (!quote) {
      return NextResponse.json({ error: `Quote with ID ${id} not found` }, { status: 404 });
    }
    return NextResponse.json(quote);
  }

  // /quote (list all)
  return NextResponse.json({ quotes, total: quotes.length });
}
