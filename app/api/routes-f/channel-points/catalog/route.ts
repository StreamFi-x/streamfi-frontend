import { NextRequest, NextResponse } from "next/server";
import { catalogStorage } from "../_lib/mock-storage";
import type {
  CatalogRequest,
  CatalogUpdateRequest,
  CatalogResponse,
  CatalogItemResponse,
  ErrorResponse,
  EmptyResponse,
} from "../_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/routes-f/channel-points/catalog?creator_id=...
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creator_id");

    if (!creatorId) {
      return NextResponse.json(
        { error: "creator_id query parameter is required" } as ErrorResponse,
        { status: 400 }
      );
    }

    const catalogItems = catalogStorage.getByCreator(creatorId);
    
    return NextResponse.json({
      data: catalogItems,
    } as CatalogResponse);
  } catch (error) {
    console.error("[channel-points catalog GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch catalog items" } as ErrorResponse,
      { status: 500 }
    );
  }
}

// POST /api/routes-f/channel-points/catalog
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { creator_id, name, cost, cooldown_seconds } = body as CatalogRequest;
    
    if (!creator_id || !name || cost === undefined || cooldown_seconds === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: creator_id, name, cost, cooldown_seconds" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (typeof cost !== "number" || cost <= 0) {
      return NextResponse.json(
        { error: "cost must be a positive number" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (typeof cooldown_seconds !== "number" || cooldown_seconds < 0) {
      return NextResponse.json(
        { error: "cooldown_seconds must be a non-negative number" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name must be a non-empty string" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Create the catalog item
    const newItem = catalogStorage.create({
      creator_id,
      name: name.trim(),
      cost,
      cooldown_seconds,
      enabled: body.enabled ?? true,
    });

    return NextResponse.json(
      {
        data: newItem,
        message: "Catalog item created successfully",
      } as CatalogItemResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error("[channel-points catalog POST]", error);
    
    if (error instanceof Error && error.message.includes("Maximum catalog items limit reached")) {
      return NextResponse.json(
        { error: error.message } as ErrorResponse,
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create catalog item" } as ErrorResponse,
      { status: 500 }
    );
  }
}