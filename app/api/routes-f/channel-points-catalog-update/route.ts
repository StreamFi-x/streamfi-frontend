/**
 * PUT /api/routes-f/channel-points-catalog-update
 * Body: { creatorId, rewardId, title?, cost?, cooldown?, stock? }
 * Updates an existing reward in a creator's channel-points catalog. At least one
 * of title / cost / cooldown / stock must be supplied. `stock: null` marks the
 * reward as unlimited. Returns the full updated reward.
 */
import { NextRequest, NextResponse } from "next/server";
import { catalog } from "./store";
import { applyUpdate, validateUpdateFields } from "./utils";
import type { CatalogUpdateBody, CatalogUpdateResponse } from "./types";

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: Partial<CatalogUpdateBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creatorId, rewardId } = body;

  if (!creatorId || typeof creatorId !== "string") {
    return NextResponse.json(
      { error: "creatorId is required" },
      { status: 400 }
    );
  }
  if (!rewardId || typeof rewardId !== "string") {
    return NextResponse.json(
      { error: "rewardId is required" },
      { status: 400 }
    );
  }

  const validationError = validateUpdateFields(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const reward = catalog.get(rewardId);
  if (!reward) {
    return NextResponse.json(
      { error: `reward "${rewardId}" not found` },
      { status: 404 }
    );
  }
  if (reward.creator_id !== creatorId) {
    return NextResponse.json(
      {
        error: `reward "${rewardId}" does not belong to creator "${creatorId}"`,
      },
      { status: 403 }
    );
  }

  const updated = applyUpdate(reward, body);
  catalog.set(updated.reward_id, updated);

  return NextResponse.json({ reward: updated } as CatalogUpdateResponse);
}
