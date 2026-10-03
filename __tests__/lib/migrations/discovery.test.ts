/**
 * @jest-environment node
 */
import { mkdtempSync, promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  buildMigrationFilename,
  checksumSql,
  discoverMigrations,
  isTransactional,
  LegacyManifest,
  loadLegacyManifest,
  MigrationDefinitionError,
} from "@/lib/migrations/discovery";
import { splitSqlStatements } from "@/lib/migrations/sql-splitter";

const REPO_MIGRATIONS = path.join(process.cwd(), "db", "migrations");

async function tempDir(files: Record<string, string>): Promise<string> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "streamfi-migrations-"));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content);
  }
  return dir;
}

const emptyManifest: LegacyManifest = { description: "", entries: [] };

describe("checksumSql", () => {
  it("is stable across CRLF/LF line endings and a BOM", () => {
    const lf = "CREATE TABLE a (id INT);\nSELECT 1;\n";
    expect(checksumSql("﻿" + lf.replace(/\n/g, "\r\n"))).toBe(checksumSql(lf));
  });

  it("changes when the SQL changes", () => {
    expect(checksumSql("SELECT 1;")).not.toBe(checksumSql("SELECT 2;"));
  });
});

describe("isTransactional", () => {
  it("defaults to transactional", () => {
    expect(isTransactional("-- adds a column\nALTER TABLE a ADD b INT;")).toBe(
      true
    );
  });

  it("honours the no-transaction directive in the leading comment block", () => {
    expect(
      isTransactional(
        "-- index\n-- migrate:no-transaction\nCREATE INDEX CONCURRENTLY i ON a(b);"
      )
    ).toBe(false);
  });

  it("ignores the directive after the first statement", () => {
    expect(
      isTransactional("SELECT 1;\n-- migrate:no-transaction\nSELECT 2;")
    ).toBe(true);
  });
});

describe("discoverMigrations", () => {
  it("orders legacy entries by manifest, then versioned files by version", async () => {
    const dir = await tempDir({
      "zz-old.sql": "SELECT 1;",
      "aa-older.sql": "SELECT 2;",
      "20260101000002_second.sql": "SELECT 3;",
      "20260101000001_first.sql": "SELECT 4;",
    });
    const manifest: LegacyManifest = {
      description: "",
      entries: [
        {
          file: "zz-old.sql",
          checksum: checksumSql("SELECT 1;"),
          probe: "true",
        },
        {
          file: "aa-older.sql",
          checksum: checksumSql("SELECT 2;"),
          probe: "true",
        },
      ],
    };

    const migrations = await discoverMigrations(dir, manifest);

    expect(migrations.map(m => m.id)).toEqual([
      "zz-old",
      "aa-older",
      "20260101000001_first",
      "20260101000002_second",
    ]);
    expect(migrations.map(m => m.kind)).toEqual([
      "legacy",
      "legacy",
      "versioned",
      "versioned",
    ]);
  });

  it("rejects files that are neither legacy nor correctly named", async () => {
    const dir = await tempDir({ "add-something-new.sql": "SELECT 1;" });
    await expect(discoverMigrations(dir, emptyManifest)).rejects.toThrow(
      /does not match YYYYMMDDHHMMSS_name\.sql/
    );
  });

  it("rejects malformed versions and upper-case names", async () => {
    for (const file of [
      "2026010100_short.sql",
      "20260101000000_Bad_Name.sql",
    ]) {
      const dir = await tempDir({ [file]: "SELECT 1;" });
      await expect(
        discoverMigrations(dir, emptyManifest)
      ).rejects.toBeInstanceOf(MigrationDefinitionError);
    }
  });

  it("rejects two migrations with the same version", async () => {
    const dir = await tempDir({
      "20260101000000_a.sql": "SELECT 1;",
      "20260101000000_b.sql": "SELECT 2;",
    });
    await expect(discoverMigrations(dir, emptyManifest)).rejects.toThrow(
      /share version 20260101000000/
    );
  });

  it("rejects empty migrations", async () => {
    const dir = await tempDir({ "20260101000000_empty.sql": "  \n" });
    await expect(discoverMigrations(dir, emptyManifest)).rejects.toThrow(
      /is empty/
    );
  });

  it("fails loudly when a frozen legacy file is edited", async () => {
    const dir = await tempDir({ "legacy.sql": "SELECT 'edited';" });
    const manifest: LegacyManifest = {
      description: "",
      entries: [
        {
          file: "legacy.sql",
          checksum: checksumSql("SELECT 1;"),
          probe: "true",
        },
      ],
    };
    await expect(discoverMigrations(dir, manifest)).rejects.toThrow(
      /was modified after it was frozen/
    );
  });

  it("fails when a legacy file listed in the manifest is missing", async () => {
    const dir = await tempDir({});
    const manifest: LegacyManifest = {
      description: "",
      entries: [{ file: "gone.sql", checksum: "0".repeat(64), probe: "true" }],
    };
    await expect(discoverMigrations(dir, manifest)).rejects.toThrow(
      /listed but missing/
    );
  });
});

describe("repository migrations", () => {
  it("every file in db/migrations is either frozen legacy or a valid versioned migration", async () => {
    const manifest = await loadLegacyManifest(
      path.join(REPO_MIGRATIONS, "legacy-manifest.json")
    );
    const migrations = await discoverMigrations(REPO_MIGRATIONS, manifest);

    expect(migrations.filter(m => m.kind === "legacy")).toHaveLength(
      manifest.entries.length
    );
    const versioned = migrations.filter(m => m.kind === "versioned");
    expect(versioned.length).toBeGreaterThan(0);
    const ids = versioned.map(m => m.id);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe("buildMigrationFilename", () => {
  it("uses a UTC timestamp and a snake_case name", () => {
    expect(
      buildMigrationFilename(
        "Add Payout Index!",
        new Date(Date.UTC(2026, 8, 25, 7, 5, 9))
      )
    ).toBe("20260925070509_add_payout_index.sql");
  });

  it("rejects names without letters or digits", () => {
    expect(() => buildMigrationFilename("--", new Date())).toThrow(
      MigrationDefinitionError
    );
  });
});

describe("splitSqlStatements", () => {
  it("splits on top-level semicolons only", () => {
    const script = `
      -- comment; with semicolon
      CREATE TABLE a (v TEXT DEFAULT 'x;y');
      /* block ; comment */
      CREATE FUNCTION f() RETURNS void AS $body$ BEGIN PERFORM 1; END $body$ LANGUAGE plpgsql;
      DO $$ BEGIN RAISE NOTICE 'a;b'; END $$;
      SELECT "odd;name" FROM a;
      SELECT E'it\\'s;fine';
    `;
    const statements = splitSqlStatements(script);
    expect(statements).toHaveLength(5);
    expect(statements[1]).toContain("$body$ BEGIN PERFORM 1; END $body$");
    expect(statements[4]).toContain("E'it\\'s;fine'");
  });

  it("drops comment-only trailing fragments", () => {
    expect(splitSqlStatements("SELECT 1;\n-- trailing\n")).toEqual([
      "SELECT 1;",
    ]);
  });

  it("throws on unterminated quotes", () => {
    expect(() => splitSqlStatements("SELECT 'oops;")).toThrow(/Unterminated/);
    expect(() => splitSqlStatements("SELECT $$ oops;")).toThrow(/Unterminated/);
  });
});
