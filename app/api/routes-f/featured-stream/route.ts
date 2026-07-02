import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "../../_lib/validate";
import { getFeaturedStream, setOverride, removeOverride } from "./store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Schemas
const getFeaturedSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
});

const overrideSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  creator_id: z.string().min(1, "creator_id is required"),
  reason: z.string().min(1, "reason is required"),
});

const removeOverrideSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

// GET /api/routes-f/featured-stream - Get featured stream of the day
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const validation = validateQuery(url.searchParams, getFeaturedSchema);
  if (validation instanceof NextResponse) return validation;

  const { date } = validation.data;
  const featured = getFeaturedStream(date);

  return NextResponse.json({
    featured,
    date: date || new Date().toISOString().split('T')[0],
    is_override: false, // This would need to be calculated in real implementation
  });
}

// POST /api/routes-f/featured-stream/override - Set editorial override
export async function POST(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, overrideSchema);
  if (validation instanceof NextResponse) return validation;

  const { date, creator_id, reason } = validation.data;

  try {
    const override = setOverride(date, creator_id, reason);
    
    return NextResponse.json({
      success: true,
      override,
      message: "Editorial override set successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to set override" },
      { status: 500 }
    );
  }
}

// DELETE /api/routes-f/featured-stream/override - Remove editorial override
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, removeOverrideSchema);
  if (validation instanceof NextResponse) return validation;

  const { date } = validation.data;
  const removed = removeOverride(date);

  if (removed) {
    return NextResponse.json({
      success: true,
      message: `Override for ${date} removed successfully`,
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        message: `No override found for ${date}`,
      },
      { status: 404 }
    );
  }
}

// PATCH /api/routes-f/featured-stream - Get stream with override info
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const validation = validateQuery(url.searchParams, getFeaturedSchema);
  if (validation instanceof NextResponse) return validation;

  const { date } = validation.data;
  const featured = getFeaturedStream(date);
  const dateKey = date || new Date().toISOString().split('T')[0];

  // In a real implementation, we would check if there's an override
  // For now, we'll return a mock is_override flag
  const { getAllOverrides } = await import("./store");
  const overrides = getAllOverrides();
  const isOverride = overrides.some(o => o.date === dateKey);

  return NextResponse.json({
    featured,
    date: dateKey,
    is_override: isOverride,
  });
}