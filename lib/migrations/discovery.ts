import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * Versioned migrations are named `YYYYMMDDHHMMSS_snake_case_name.sql`. The
 * 14-digit UTC timestamp is the migration's immutable version; the full file
 * stem (version + name) is its identity in `schema_migrations`.
 */
export const VERSIONED_FILENAME = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

const NO_TRANSACTION_DIRECTIVE = /^--\s*migrate:no-transaction\s*$/i;

export interface LegacyManifestEntry {
  /** File name inside db/migrations. Legacy files keep their original names. */
  file: string;
  /** SHA-256 of the LF-normalised file contents when the manifest was frozen. */
  checksum: string;
  /** SQL boolean expression proving the migration's effect is present. */
  probe: string;
}

export interface LegacyManifest {
  description: string;
  entries: LegacyManifestEntry[];
}

export interface Migration {
  /** Identity stored in schema_migrations.version. */
  id: string;
  file: string;
  kind: "legacy" | "versioned";
  checksum: string;
  sql: string;
  transactional: boolean;
  /** Only present for legacy migrations. */
  probe?: string;
}

export class MigrationDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationDefinitionError";
  }
}

/**
 * Checksums are taken over LF-normalised content without a BOM so the same
 * file hashes identically on Windows checkouts (core.autocrlf) and on Linux.
 */
export function normaliseSql(content: string): string {
  return content.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

export function checksumSql(content: string): string {
  return createHash("sha256")
    .update(normaliseSql(content), "utf8")
    .digest("hex");
}

/**
 * A migration opts out of the wrapping transaction with a directive in its
 * leading comment block:
 *
 *   -- migrate:no-transaction
 */
export function isTransactional(content: string): boolean {
  for (const rawLine of normaliseSql(content).split("\n")) {
    const line = rawLine.trim();
    if (line === "") {
      continue;
    }
    if (!line.startsWith("--")) {
      break;
    }
    if (NO_TRANSACTION_DIRECTIVE.test(line)) {
      return false;
    }
  }
  return true;
}

export function stemOf(file: string): string {
  return file.replace(/\.sql$/, "");
}

/**
 * Discovers every migration in `dir` and returns them in apply order:
 * legacy migrations in manifest order first, then versioned migrations sorted
 * by version. Anything that is neither listed in the manifest nor correctly
 * named is rejected instead of being silently skipped or guessed at.
 */
export async function discoverMigrations(
  dir: string,
  manifest: LegacyManifest
): Promise<Migration[]> {
  const files = (await fs.readdir(dir)).filter(f => f.endsWith(".sql")).sort();
  const legacyFiles = new Map(manifest.entries.map(e => [e.file, e]));

  if (legacyFiles.size !== manifest.entries.length) {
    throw new MigrationDefinitionError(
      "Legacy manifest lists the same file more than once"
    );
  }

  const legacy: Migration[] = [];
  const versioned: Migration[] = [];
  const seenVersions = new Map<string, string>();
  const problems: string[] = [];

  for (const entry of manifest.entries) {
    if (!files.includes(entry.file)) {
      problems.push(`Legacy migration ${entry.file} is listed but missing`);
    }
  }

  for (const file of files) {
    const content = await fs.readFile(path.join(dir, file), "utf8");
    const checksum = checksumSql(content);
    const legacyEntry = legacyFiles.get(file);

    if (legacyEntry) {
      if (legacyEntry.checksum !== checksum) {
        problems.push(
          `Legacy migration ${file} was modified after it was frozen ` +
            `(expected ${legacyEntry.checksum}, found ${checksum}). ` +
            "Historical migrations are immutable; add a new migration instead."
        );
      }
      legacy.push({
        id: stemOf(file),
        file,
        kind: "legacy",
        checksum,
        sql: normaliseSql(content),
        transactional: isTransactional(content),
        probe: legacyEntry.probe,
      });
      continue;
    }

    const match = VERSIONED_FILENAME.exec(file);
    if (!match) {
      problems.push(
        `Migration ${file} does not match YYYYMMDDHHMMSS_name.sql ` +
          "(use `npm run db:migrate -- create <name>`)"
      );
      continue;
    }

    const version = match[1];
    const clash = seenVersions.get(version);
    if (clash) {
      problems.push(`Migrations ${clash} and ${file} share version ${version}`);
      continue;
    }
    seenVersions.set(version, file);

    if (normaliseSql(content).trim() === "") {
      problems.push(`Migration ${file} is empty`);
      continue;
    }

    versioned.push({
      id: stemOf(file),
      file,
      kind: "versioned",
      checksum,
      sql: normaliseSql(content),
      transactional: isTransactional(content),
    });
  }

  if (problems.length > 0) {
    throw new MigrationDefinitionError(problems.join("\n"));
  }

  const legacyOrder = new Map(manifest.entries.map((e, idx) => [e.file, idx]));
  legacy.sort(
    (a, b) => (legacyOrder.get(a.file) ?? 0) - (legacyOrder.get(b.file) ?? 0)
  );
  versioned.sort((a, b) => a.id.localeCompare(b.id));

  return [...legacy, ...versioned];
}

export async function loadLegacyManifest(
  file: string
): Promise<LegacyManifest> {
  const parsed = JSON.parse(await fs.readFile(file, "utf8")) as LegacyManifest;
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new MigrationDefinitionError(
      `${file} is not a valid legacy manifest`
    );
  }
  for (const entry of parsed.entries) {
    if (!entry.file || !/^[0-9a-f]{64}$/.test(entry.checksum) || !entry.probe) {
      throw new MigrationDefinitionError(
        `${file} has an invalid entry: ${JSON.stringify(entry)}`
      );
    }
  }
  return parsed;
}

/** Builds a new versioned file name from a UTC timestamp and a free-form name. */
export function buildMigrationFilename(name: string, now: Date): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!slug) {
    throw new MigrationDefinitionError(
      "Migration name must contain letters or digits"
    );
  }
  const pad = (v: number) => String(v).padStart(2, "0");
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `${stamp}_${slug}.sql`;
}
