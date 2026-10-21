/**
 * scripts/simulate-chat-spike.ts
 *
 * Demonstrates the 100 → 50,000 viewer ramp scenario for the chat backpressure
 * system (#1139). It calls recordAndGetSpikeLevel() directly — no HTTP auth
 * session needed — to show how the spike level advances from 'normal' through
 * 'degraded' to 'critical' as simulated message volume increases.
 *
 * Run with:
 *   npx ts-node scripts/simulate-chat-spike.ts
 *   npx tsx scripts/simulate-chat-spike.ts
 *
 * Env vars (optional):
 *   STREAMER_ID            — UUID of the stream to target (default: synthetic)
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *                          — when absent, Redis returns null and level stays
 *                             'normal' (expected fallback — script reports it)
 */

import { recordAndGetSpikeLevel, getPollIntervalSeconds, getEffectiveSlowMode } from "../lib/chat-spike";

const STREAMER_ID =
  process.env.STREAMER_ID ?? `simulate-${Date.now()}`;

/**
 * Simulate a batch of `count` messages being sent to a stream within a short
 * burst and return the spike level after the last one.
 */
async function simulateBurst(
  streamerId: string,
  count: number
): Promise<string> {
  let level = "normal";
  for (let i = 0; i < count; i++) {
    level = await recordAndGetSpikeLevel(streamerId);
  }
  return level;
}

async function main() {
  console.log("=== StreamFi Chat Backpressure Simulation (#1139) ===");
  console.log(`Streamer ID : ${STREAMER_ID}`);
  console.log(
    "Note: without Redis env vars, level will stay 'normal' (expected fallback)\n"
  );

  // Stages: approximate message counts that correspond to viewer ramp milestones.
  // At ~10 messages/viewer/minute, 100 viewers → ~17 msgs/60s (normal),
  // 3000 viewers → ~500 msgs/60s (degraded), 12000 viewers → ~2000 msgs/60s (critical).
  const stages: Array<{ label: string; burstSize: number }> = [
    { label: "100 viewers  (~17 msgs/60s)",    burstSize: 17 },
    { label: "500 viewers  (~83 msgs/60s)",    burstSize: 83 },
    { label: "3000 viewers (~500 msgs/60s)",   burstSize: 500 },
    { label: "5000 viewers (~833 msgs/60s)",   burstSize: 833 },
    { label: "12000 viewers (~2000 msgs/60s)", burstSize: 2000 },
    { label: "50000 viewers (~8333 msgs/60s)", burstSize: 8333 },
  ];

  for (const stage of stages) {
    // Use a fresh streamerId per stage so each burst starts from zero
    // (Redis keys expire naturally; this avoids waiting for 60s between stages)
    const stageId = `${STREAMER_ID}-${stage.label.replace(/\s+/g, "-")}`;
    const level = await simulateBurst(stageId, stage.burstSize);
    const poll = getPollIntervalSeconds(level as "normal" | "degraded" | "critical");
    const slowMode = getEffectiveSlowMode(3, level as "normal" | "degraded" | "critical");

    const indicator =
      level === "critical" ? "🔴" : level === "degraded" ? "🟡" : "🟢";
    console.log(
      `${indicator}  ${stage.label.padEnd(30)} level=${level.padEnd(9)} poll=${poll}s  slowMode≥${slowMode}s`
    );
  }

  console.log("\n=== Expected progression ===");
  console.log("🟢 normal   → full speed, 3s poll, configured slow mode");
  console.log("🟡 degraded → 10s poll, slow mode floor 5s, viewer banner");
  console.log("🔴 critical → 30s poll, slow mode floor 15s, typing indicators shed, viewer banner");
  console.log("\nWhen Redis is unavailable, all levels report 'normal' — this is the intended safe fallback.");
}

main().catch(err => {
  console.error("Simulation error:", err);
  process.exit(1);
});
