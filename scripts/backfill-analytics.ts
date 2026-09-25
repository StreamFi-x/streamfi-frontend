#!/usr/bin/env node
/**
 * CLI tool for running analytics backfill jobs
 * Usage:
 *   npm run backfill -- watch_history
 *   npm run backfill -- session_retention
 *   npm run backfill -- session_chat_engagement
 *   npm run backfill -- all
 */

import {
  ensureBackfillSchema,
  getBackfillStatus,
  backfillWatchHistory,
  backfillSessionRetention,
  backfillSessionChatEngagement,
  type BackfillTableName,
  type BackfillResult,
} from "../lib/routes-f/backfill";

const args = process.argv.slice(2);
const tableName = (args[0] || "all").toLowerCase();

async function runBackfill() {
  console.log("[backfill] Starting analytics backfill CLI");

  try {
    await ensureBackfillSchema();
    console.log("✓ Backfill schema verified");
  } catch (error) {
    console.error(
      "✗ Backfill schema not initialized:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }

  const results: BackfillResult[] = [];

  try {
    if (tableName === "all" || tableName === "watch_history") {
      console.log("\n[backfill] Running watch_history backfill...");
      const result = await backfillWatchHistory(1000);
      results.push(result);
      printResult(result);
    }

    if (tableName === "all" || tableName === "session_retention") {
      console.log("\n[backfill] Running session_retention backfill...");
      const result = await backfillSessionRetention(100);
      results.push(result);
      printResult(result);
    }

    if (tableName === "all" || tableName === "session_chat_engagement") {
      console.log("\n[backfill] Running session_chat_engagement backfill...");
      const result = await backfillSessionChatEngagement(100);
      results.push(result);
      printResult(result);
    }

    if (!["all", "watch_history", "session_retention", "session_chat_engagement"].includes(tableName)) {
      console.error(`✗ Unknown table: ${tableName}`);
      console.error(
        "Valid tables: all, watch_history, session_retention, session_chat_engagement"
      );
      process.exit(1);
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("BACKFILL SUMMARY");
    console.log("=".repeat(60));

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalDuration = 0;
    let failureCount = 0;

    for (const result of results) {
      totalProcessed += result.rowsProcessed;
      totalSkipped += result.rowsSkipped;
      totalDuration += result.duration;
      if (!result.success) failureCount++;
    }

    console.log(`Total rows processed: ${totalProcessed}`);
    console.log(`Total rows skipped: ${totalSkipped}`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Jobs with errors: ${failureCount}`);

    // Print current status
    console.log("\n" + "-".repeat(60));
    console.log("CURRENT BACKFILL STATUS");
    console.log("-".repeat(60));

    const status = await getBackfillStatus();
    for (const job of status) {
      console.log(`\n${job.table_name}:`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Rows backfilled: ${job.rows_backfilled}`);
      console.log(`  Rows skipped: ${job.rows_skipped}`);
      if (job.last_backfill_at) {
        console.log(
          `  Last backfill: ${new Date(job.last_backfill_at).toISOString()}`
        );
      }
      if (job.error_message) {
        console.log(`  Error: ${job.error_message}`);
      }
    }

    process.exit(failureCount > 0 ? 1 : 0);
  } catch (error) {
    console.error(
      "✗ Backfill failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

function printResult(result: BackfillResult) {
  if (result.success) {
    console.log(`✓ ${result.tableName} backfill completed`);
    console.log(`  Rows processed: ${result.rowsProcessed}`);
    console.log(`  Rows skipped: ${result.rowsSkipped}`);
    console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);
  } else {
    console.log(`✗ ${result.tableName} backfill FAILED`);
    console.log(`  Error: ${result.error}`);
    console.log(`  Rows processed: ${result.rowsProcessed}`);
    console.log(`  Rows skipped: ${result.rowsSkipped}`);
  }
}

runBackfill();
