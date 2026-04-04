import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyMuxSignature, handleMuxEvent } from "./_lib/mux";
import { verifyTransakSignature, handleTransakEvent } from "./_lib/transak";
import { handleStellarEvent } from "./_lib/stellar";

// ────────────────────────────────────────────────────────────────
// Audit table setup
// ────────────────────────────────────────────────────────────────

async function ensureWebhookAuditTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_webhook_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider    VARCHAR(30) NOT NULL,
      event_type  VARCHAR(100),
      payload     JSONB NOT NULL,
      handled     BOOLEAN NOT NULL DEFAULT false,
      detail      TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
    ON route_f_webhook_events(provider, received_at DESC)
  `;
}

// ────────────────────────────────────────────────────────────────
// POST /api/routes-f/webhook?provider=mux|transak|stellar
// Unified webhook ingestion endpoint.
// ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const provider = new URL(req.url).searchParams.get("provider");

  if (!provider || !["mux", "transak", "stellar"].includes(provider)) {
    return NextResponse.json(
      {
        error: "Unknown or missing provider",
        accepted_providers: ["mux", "transak", "stellar"],
      },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ────────────────────────────────────────────────────────────────
  // Signature verification per provider
  // ────────────────────────────────────────────────────────────────

  if (provider === "mux") {
    const secret = process.env.MUX_WEBHOOK_SECRET;
    const signature = req.headers.get("mux-signature");

    if (secret) {
      if (!signature) {
        return NextResponse.json(
          { error: "Missing mux-signature header" },
          { status: 401 }
        );
      }
      if (!verifyMuxSignature(signature, rawBody, secret)) {
        return NextResponse.json(
          { error: "Invalid Mux signature" },
          { status: 401 }
        );
      }
    } else {
      console.warn(
        "[webhook] MUX_WEBHOOK_SECRET not set — skipping signature verification"
      );
    }
  }

  if (provider === "transak") {
    const secret = process.env.TRANSAK_WEBHOOK_SECRET;
    const signature = req.headers.get("x-transak-signature");

    if (secret) {
      if (!signature) {
        return NextResponse.json(
          { error: "Missing X-Transak-Signature header" },
          { status: 401 }
        );
      }
      if (!verifyTransakSignature(signature, rawBody, secret)) {
        return NextResponse.json(
          { error: "Invalid Transak signature" },
          { status: 401 }
        );
      }
    } else {
      console.warn(
        "[webhook] TRANSAK_WEBHOOK_SECRET not set — skipping signature verification"
      );
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Route to provider-specific handler
  // ────────────────────────────────────────────────────────────────

  let result: { handled: boolean; detail: string };

  try {
    switch (provider) {
      case "mux":
        result = await handleMuxEvent(payload);
        break;
      case "transak":
        result = await handleTransakEvent(payload);
        break;
      case "stellar":
        result = await handleStellarEvent(payload);
        break;
      default:
        result = { handled: false, detail: "Unknown provider" };
    }
  } catch (error) {
    console.error(`[webhook/${provider}] Handler error:`, error);
    result = {
      handled: false,
      detail: error instanceof Error ? error.message : "Handler error",
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Audit log: record raw payload
  // ────────────────────────────────────────────────────────────────

  try {
    await ensureWebhookAuditTable();

    const eventType =
      (payload.type as string) ?? (payload.eventID as string) ?? "unknown";

    await sql`
      INSERT INTO route_f_webhook_events (provider, event_type, payload, handled, detail)
      VALUES (
        ${provider},
        ${eventType},
        ${JSON.stringify(payload)}::jsonb,
        ${result.handled},
        ${result.detail}
      )
    `;
  } catch (auditError) {
    // Don't fail the webhook response if audit logging fails
    console.error("[webhook] Audit log error:", auditError);
  }

  console.log(
    `[webhook/${provider}] ${result.handled ? "✅" : "⚠️"} ${result.detail}`
  );

  return NextResponse.json(
    { received: true, handled: result.handled, detail: result.detail },
    { status: 200 }
  );
}
