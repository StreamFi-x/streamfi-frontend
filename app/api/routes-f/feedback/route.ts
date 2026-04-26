import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, stripHtmlTags, storeFeedback, generateId } from "./_lib/helpers";
import { StoredFeedback } from "./_lib/types";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown-ip";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { message, category, contact } = body;

    // Validation
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required and must be a string" }, { status: 400 });
    }
    if (message.length < 10 || message.length > 2000) {
      return NextResponse.json({ error: "Message length must be between 10 and 2000 characters" }, { status: 400 });
    }

    const validCategories = ["bug", "feature", "other"];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (contact !== undefined && typeof contact !== "string") {
      return NextResponse.json({ error: "Contact must be a string" }, { status: 400 });
    }

    // Sanitize HTML
    const sanitizedMessage = stripHtmlTags(message);
    const sanitizedContact = contact ? stripHtmlTags(contact) : undefined;

    // Store feedback
    const newFeedback: StoredFeedback = {
      id: generateId(),
      message: sanitizedMessage,
      category: category as "bug" | "feature" | "other",
      contact: sanitizedContact,
      ip,
      createdAt: new Date().toISOString(),
    };

    storeFeedback(newFeedback);

    return NextResponse.json(
      { success: true, message: "Feedback submitted successfully" },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
