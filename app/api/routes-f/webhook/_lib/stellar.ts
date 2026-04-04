// ────────────────────────────────────────────────────────────────
// Stellar webhook handler (Horizon payment stream callbacks)
// ────────────────────────────────────────────────────────────────

/**
 * Handle Stellar Horizon payment stream callbacks.
 * Stellar doesn't use signature verification in the same way —
 * these are callbacks from our own Horizon subscription,
 * so we rely on the endpoint being secret/internal.
 */
export async function handleStellarEvent(
  payload: Record<string, unknown>
): Promise<{
  handled: boolean;
  detail: string;
}> {
  const type = payload.type as string | undefined;
  const id = payload.id as string | undefined;

  if (!type || !id) {
    return { handled: false, detail: "Missing type or id in Stellar payload" };
  }

  // For payment events, log and record
  if (type === "payment" || type === "create_account") {
    const from = payload.from as string | undefined;
    const to = payload.to as string | undefined;
    const amount = payload.amount as string | undefined;
    const assetType = payload.asset_type as string | undefined;

    console.log(
      `[webhook/stellar] Payment ${id}: ${from} → ${to}, ${amount} ${assetType ?? "native"}`
    );

    return {
      handled: true,
      detail: `Stellar payment ${id} logged`,
    };
  }

  return {
    handled: false,
    detail: `Unhandled Stellar event type: ${type}`,
  };
}
