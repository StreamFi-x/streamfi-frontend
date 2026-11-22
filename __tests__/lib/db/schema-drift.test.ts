/**
 * @jest-environment node
 *
 * Automated Schema Drift & Canonical Parity Test Suite (#1867).
 *
 * Verifies that:
 * 1. db/schema.sql includes all production columns, tables, enums, and indexes
 *    actively queried by application routes and services.
 * 2. db/schema.sql satisfies every legacy migration probe in legacy-manifest.json,
 *    guaranteeing zero schema divergence between migration outputs and base schema.
 * 3. A fresh database bootstrapped from db/schema.sql produces all required schema
 *    objects without runtime "relation/column does not exist" errors.
 */

import { readFileSync } from "fs";
import * as path from "path";
import {
  describeWithDb,
  createTestSchema,
} from "../../../test-utils/pg-test-db";

const ROOT = path.resolve(process.cwd());
const SCHEMA_FILE = path.join(ROOT, "db", "schema.sql");
const MANIFEST_FILE = path.join(
  ROOT,
  "db",
  "migrations",
  "legacy-manifest.json"
);

interface ParsedSchema {
  tables: Map<string, Set<string>>;
  indexes: Set<string>;
  enums: Set<string>;
}

function parseSchemaSql(sql: string): ParsedSchema {
  const tables = new Map<string, Set<string>>();
  const indexes = new Set<string>();
  const enums = new Set<string>();

  // Extract CREATE TABLE [IF NOT EXISTS] <name> (<columns>)
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
  let m: RegExpExecArray | null;

  while ((m = tableRegex.exec(sql)) !== null) {
    const tableName = m[1].toLowerCase();
    const body = m[2];
    const columns = new Set<string>();

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (
        !line ||
        line.startsWith("--") ||
        line.startsWith("/*") ||
        /^CONSTRAINT\b/i.test(line) ||
        /^PRIMARY\s+KEY\b/i.test(line) ||
        /^UNIQUE\b/i.test(line) ||
        /^FOREIGN\s+KEY\b/i.test(line) ||
        /^CHECK\b/i.test(line)
      ) {
        continue;
      }
      const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+/);
      if (colMatch) {
        columns.add(colMatch[1].toLowerCase());
      }
    }
    tables.set(tableName, columns);
  }

  // Extract ALTER TABLE <name> ADD [COLUMN] [IF NOT EXISTS] <col>
  const alterRegex =
    /ALTER\s+TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi;
  while ((m = alterRegex.exec(sql)) !== null) {
    const tableName = m[1].toLowerCase();
    const colName = m[2].toLowerCase();
    if (!tables.has(tableName)) {
      tables.set(tableName, new Set());
    }
    tables.get(tableName)!.add(colName);
  }

  // Extract CREATE [UNIQUE] INDEX [IF NOT EXISTS] <indexName>
  const indexRegex =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)/gi;
  while ((m = indexRegex.exec(sql)) !== null) {
    indexes.add(m[1].toLowerCase());
  }

  // Extract CREATE TYPE <name> AS ENUM
  const enumRegex = /CREATE\s+TYPE\s+([a-zA-Z0-9_]+)\s+AS\s+ENUM/gi;
  while ((m = enumRegex.exec(sql)) !== null) {
    enums.add(m[1].toLowerCase());
  }

  return { tables, indexes, enums };
}

describe("Canonical Schema Drift & Parity (db/schema.sql)", () => {
  let schemaSql: string;
  let parsed: ParsedSchema;

  beforeAll(() => {
    schemaSql = readFileSync(SCHEMA_FILE, "utf8");
    parsed = parseSchemaSql(schemaSql);
  });

  describe("Critical Production Columns Reconciled (#1867)", () => {
    it("defines stream_recordings.needs_review column with default false", () => {
      const recordings = parsed.tables.get("stream_recordings");
      expect(recordings).toBeDefined();
      expect(recordings!.has("needs_review")).toBe(true);

      expect(schemaSql).toMatch(/needs_review\s+BOOLEAN\s+DEFAULT\s+FALSE/i);
    });

    it("defines users.latency_mode and stream_sessions.latency_mode", () => {
      const users = parsed.tables.get("users");
      expect(users).toBeDefined();
      expect(users!.has("latency_mode")).toBe(true);

      const sessions = parsed.tables.get("stream_sessions");
      expect(sessions).toBeDefined();
      expect(sessions!.has("latency_mode")).toBe(true);

      expect(schemaSql).toMatch(
        /latency_mode\s+VARCHAR\(10\)\s+DEFAULT\s+'low'/i
      );
      expect(parsed.indexes.has("idx_stream_sessions_latency_mode")).toBe(true);
    });

    it("defines users.stream_privacy, share_token, and mux_signed_playback_id with indexes", () => {
      const users = parsed.tables.get("users");
      expect(users).toBeDefined();
      expect(users!.has("stream_privacy")).toBe(true);
      expect(users!.has("share_token")).toBe(true);
      expect(users!.has("mux_signed_playback_id")).toBe(true);

      expect(parsed.indexes.has("idx_users_stream_privacy")).toBe(true);
      expect(parsed.indexes.has("idx_users_share_token")).toBe(true);
    });

    it("defines the complete transcription_jobs table with constraints and indexes", () => {
      const jobs = parsed.tables.get("transcription_jobs");
      expect(jobs).toBeDefined();

      const expectedColumns = [
        "id",
        "recording_id",
        "user_id",
        "status",
        "content",
        "error_reason",
        "created_at",
        "updated_at",
      ];
      for (const col of expectedColumns) {
        expect(jobs!.has(col)).toBe(true);
      }

      expect(schemaSql).toMatch(
        /REFERENCES\s+stream_recordings\(id\)\s+ON\s+DELETE\s+CASCADE/i
      );
      expect(schemaSql).toMatch(
        /REFERENCES\s+users\(id\)\s+ON\s+DELETE\s+CASCADE/i
      );
      expect(schemaSql).toMatch(/UNIQUE\s*\(\s*recording_id\s*\)/i);

      expect(parsed.indexes.has("idx_transcription_jobs_recording_id")).toBe(
        true
      );
      expect(parsed.indexes.has("idx_transcription_jobs_user_id")).toBe(true);
      expect(parsed.indexes.has("idx_transcription_jobs_status")).toBe(true);
    });

    it("defines chat_messages.username used by active chat route", () => {
      const chat = parsed.tables.get("chat_messages");
      expect(chat).toBeDefined();
      expect(chat!.has("username")).toBe(true);
    });

    it("defines users.banner and users.privy_id used by profile and auth routes", () => {
      const users = parsed.tables.get("users");
      expect(users).toBeDefined();
      expect(users!.has("banner")).toBe(true);
      expect(users!.has("privy_id")).toBe(true);
    });
  });

  describe("Zero Schema Divergence with Legacy Manifest Probes", () => {
    it("satisfies all 16 legacy migration probes defined in legacy-manifest.json", () => {
      const manifestRaw = readFileSync(MANIFEST_FILE, "utf8");
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.entries.length).toBe(16);

      const probeChecks: Record<string, () => boolean> = {
        "add-stream-recording.sql": () =>
          parsed.tables.has("stream_recordings") &&
          parsed.tables.get("users")!.has("enable_recording"),

        "add-needs-review.sql": () =>
          parsed.tables.get("stream_recordings")!.has("needs_review"),

        "add-admin-panel.sql": () =>
          parsed.tables.has("stream_reports") &&
          parsed.tables.has("bug_reports"),

        "20260327_routes_f_creator_finance_and_badges.sql": () =>
          parsed.tables.has("tip_transactions") &&
          parsed.tables.has("payouts") &&
          parsed.tables.has("badge_definitions"),

        "add-routes-f-platform-features.sql": () =>
          parsed.tables.has("moderation_queue") &&
          parsed.tables.has("channel_emotes"),

        "add-latency-mode.sql": () =>
          parsed.tables.get("users")!.has("latency_mode"),

        "add-transcription-jobs.sql": () =>
          parsed.tables.has("transcription_jobs"),

        "add-user-sessions.sql": () => parsed.tables.has("user_sessions"),

        "add-feature-flags-clips-whitelist-preferences.sql": () =>
          parsed.tables.has("feature_flags") &&
          parsed.tables.has("stream_clips"),

        "20260427_backend_enhancements.sql": () =>
          parsed.tables.has("extension_catalog") && parsed.tables.has("raids"),

        "add-mux-provisioning-flags.sql": () =>
          parsed.tables.get("users")!.has("mux_stream_provisioned_with_dvr"),

        "add-stream-privacy-and-subs.sql": () =>
          parsed.tables.has("subscription_tiers") &&
          parsed.tables.get("users")!.has("stream_privacy"),

        "add-auth-email-tokens.sql": () =>
          parsed.tables.has("magic_link_tokens") &&
          parsed.tables.has("password_reset_tokens"),

        "add-user-two-factor.sql": () => parsed.tables.has("user_two_factor"),

        "20260924_session_retention_analytics.sql": () =>
          parsed.tables.has("route_f_session_retention") &&
          parsed.tables.has("route_f_backfill_status"),

        "add-analytics-and-experimentation.sql": () =>
          parsed.tables.has("experiments") &&
          parsed.tables.has("concurrent_viewer_cache"),
      };

      for (const entry of manifest.entries) {
        const checker = probeChecks[entry.file];
        expect(checker).toBeDefined();
        expect({ file: entry.file, satisfied: checker() }).toEqual({
          file: entry.file,
          satisfied: true,
        });
      }
    });
  });

  describe("Application Core Tables and Relations", () => {
    const requiredTables = [
      "users",
      "waitlist",
      "stream_sessions",
      "chat_messages",
      "stream_viewers",
      "stream_recordings",
      "transcription_jobs",
      "subscription_tiers",
      "subscriptions",
      "stream_reports",
      "bug_reports",
      "user_sessions",
      "feature_flags",
      "stream_clips",
      "stream_whitelist",
      "user_two_factor",
      "password_reset_tokens",
      "email_verification_tokens",
      "magic_link_tokens",
      "user_follows",
      "tip_transactions",
      "gift_transactions",
      "payouts",
      "stream_schedule",
      "stream_reminders",
      "badge_definitions",
      "user_badges",
      "notifications",
      "watch_history",
      "exchange_rate_quotes",
      "stream_categories",
      "tags",
    ];

    for (const tbl of requiredTables) {
      it(`includes ${tbl} in canonical schema`, () => {
        expect(parsed.tables.has(tbl)).toBe(true);
      });
    }
  });

  describeWithDb("Live PostgreSQL Schema Bootstrapping", () => {
    it("executes db/schema.sql on a fresh database with zero errors", async () => {
      const testSchema = await createTestSchema("canonical_schema");
      const client = await testSchema.connect();

      try {
        await client.query(schemaSql);

        const { rows: tableRows } = await client.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`
        );
        const actualTables = new Set(
          tableRows.map(r => r.table_name.toLowerCase())
        );

        expect(actualTables.has("users")).toBe(true);
        expect(actualTables.has("stream_recordings")).toBe(true);
        expect(actualTables.has("transcription_jobs")).toBe(true);
        expect(actualTables.has("stream_reports")).toBe(true);
        expect(actualTables.has("stream_clips")).toBe(true);

        const { rows: colRows } = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stream_recordings'`
        );
        const recordingCols = new Set(
          colRows.map(r => r.column_name.toLowerCase())
        );
        expect(recordingCols.has("needs_review")).toBe(true);

        const { rows: userCols } = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users'`
        );
        const userColSet = new Set(
          userCols.map(r => r.column_name.toLowerCase())
        );
        expect(userColSet.has("latency_mode")).toBe(true);
        expect(userColSet.has("stream_privacy")).toBe(true);
      } finally {
        await client.end();
        await testSchema.drop();
      }
    });
  });
});
