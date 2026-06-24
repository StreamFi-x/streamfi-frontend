import type { TipRecord } from "./types";

// Generate realistic seed data with ~50 tip records
// Distributed across different timeframes to test all filtering scenarios
export function generateSeedData(): TipRecord[] {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  const creatorId = "creator_xyz_123";
  const tippers = [
    "alice_fan",
    "bob_supporter",
    "charlie_whale",
    "diana_casual",
    "eve_regular",
    "frank_loyal",
    "grace_super",
    "henry_vip",
    "ivy_top",
    "jack_monthly",
  ];

  const records: TipRecord[] = [];
  let id = 1;

  // All-time tips (spread across last 3 months)
  for (let i = 0; i < 30; i++) {
    const tipperIdx = i % tippers.length;
    const daysAgo = Math.floor(Math.random() * 90); // Last 3 months
    const amount = Math.floor(Math.random() * 500) + 10; // $10 - $510

    records.push({
      id: `tip_${id++}`,
      creator_id: creatorId,
      tipper: tippers[tipperIdx],
      amount_usdc: amount,
      timestamp: now - daysAgo * oneDay - Math.random() * oneDay,
    });
  }

  // Monthly tips (last 30 days)
  for (let i = 0; i < 10; i++) {
    const tipperIdx = i % tippers.length;
    const daysAgo = Math.floor(Math.random() * 30);
    const amount = Math.floor(Math.random() * 300) + 20; // $20 - $320

    records.push({
      id: `tip_${id++}`,
      creator_id: creatorId,
      tipper: tippers[tipperIdx],
      amount_usdc: amount,
      timestamp: now - daysAgo * oneDay - Math.random() * oneDay,
    });
  }

  // Weekly tips (last 7 days)
  for (let i = 0; i < 8; i++) {
    const tipperIdx = i % tippers.length;
    const daysAgo = Math.floor(Math.random() * 7);
    const amount = Math.floor(Math.random() * 200) + 25; // $25 - $225

    records.push({
      id: `tip_${id++}`,
      creator_id: creatorId,
      tipper: tippers[tipperIdx],
      amount_usdc: amount,
      timestamp: now - daysAgo * oneDay - Math.random() * 12 * 60 * 60 * 1000,
    });
  }

  // Daily tips (today)
  for (let i = 0; i < 5; i++) {
    const tipperIdx = i % tippers.length;
    const amount = Math.floor(Math.random() * 150) + 30; // $30 - $180

    records.push({
      id: `tip_${id++}`,
      creator_id: creatorId,
      tipper: tippers[tipperIdx],
      amount_usdc: amount,
      timestamp: now - Math.random() * oneDay,
    });
  }

  return records;
}

// In-memory store for tip records
export const tipStore: TipRecord[] = generateSeedData();

export function addTip(tip: TipRecord): void {
  tipStore.push(tip);
}

export function getTipsForCreator(creatorId: string): TipRecord[] {
  return tipStore.filter(tip => tip.creator_id === creatorId);
}
