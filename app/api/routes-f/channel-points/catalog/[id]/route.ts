import { NextRequest, NextResponse } from "next/server";
import { catalogStorage } from "../../_lib/mock-storage";
import type {
  CatalogUpdateRequest,
  CatalogItemResponse,
  ErrorResponse,
  EmptyResponse,
} from "../../_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/routes-f/channel-points/catalog/[id]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Catalog item ID is required" } as ErrorResponse,
        { status: 400 }
      );
    }

    const body = await req.json();
    const updates = body as CatalogUpdateRequest;

    // Validate updates
    if (updates.cost !== undefined && (typeof updates.cost !== "number" || updates.cost <= 0)) {
      return NextResponse.json(
        { error: "cost must be a positive number" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (updates.cooldown_seconds !== undefined && (typeof updates.cooldown_seconds !== "number" || updates.cooldown_seconds < 0)) {
      return NextResponse.json(
        { error: "cooldown_seconds must be a non-negative number" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (updates.name !== undefined && (typeof updates.name !== "string" || updates.name.trim().length === 0)) {
      return NextResponse.json(
        { error: "name must be a non-empty string" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Update the catalog item
    const updatedItem = catalogStorage.update(id, {
      name: updates.name?.trim(),
      cost: updates.cost,
      cooldown_seconds: updates.cooldown_seconds,
      enabled: updates.enabled,
    });

    if (!updatedItem) {
      return NextResponse.json(
        { error: "Catalog item not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: updatedItem,
      message: "Catalog item updated successfully",
    } as CatalogItemResponse);
  } catch (error) {
    console.error("[channel-points catalog PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update catalog item" } as ErrorResponse,
      { status: 500 }
    );
  }
}

// DELETE /api/routes-f/channel-points/catalog/[id]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Catalog item ID is required" } as ErrorResponse,
        { status: 400 }
      );
    }

    const deleted = catalogStorage.delete(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Catalog item not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {},
      message: "Catalog item deleted successfully",
    } as EmptyResponse);
  } catch (error) {
    console.error("[channel-points catalog DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete catalog item" } as ErrorResponse,
      { status: 500 }
    );
  }
}