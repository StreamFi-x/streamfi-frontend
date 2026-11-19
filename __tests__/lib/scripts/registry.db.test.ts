/**
 * @jest-environment node
 *
 * Runs against a real PostgreSQL instance (TEST_DATABASE_URL).
 */
import type { Client } from "pg";
import {
  ScriptAlreadyRanError,
  getScriptRun,
  runOnce,
} from "@/lib/scripts/registry";
import {
  createTestSchema,
  describeWithDb,
  TestSchema,
} from "@/test-utils/pg-test-db";

jest.setTimeout(30_000);

describeWithDb("script_runs registry (PostgreSQL)", () => {
  let schema: TestSchema;
  let clients: Client[];

  beforeEach(async () => {
    schema = await createTestSchema("script_runs");
    clients = [];
  });

  afterEach(async () => {
    await Promise.all(clients.map(c => c.end().catch(() => undefined)));
    await schema.drop();
  });

  async function client(): Promise<Client> {
    const c = await schema.connect();
    clients.push(c);
    return c;
  }

  it("returns null for a script that has never run", async () => {
    const c = await client();
    expect(await getScriptRun(c, "never-run")).toBeNull();
  });

  it("records a completed run and the work actually happens", async () => {
    const c = await client();
    let ran = false;

    await runOnce(c, "example-script", async () => {
      ran = true;
    });

    expect(ran).toBe(true);
    const row = await getScriptRun(c, "example-script");
    expect(row?.status).toBe("completed");
    expect(row?.finished_at).not.toBeNull();
  });

  it("refuses a second run of the same script and does not re-run the work", async () => {
    const c = await client();
    let runCount = 0;
    const fn = async () => {
      runCount += 1;
    };

    await runOnce(c, "once-only", fn);
    await expect(runOnce(c, "once-only", fn)).rejects.toThrow(
      ScriptAlreadyRanError
    );

    expect(runCount).toBe(1);
  });

  it("allows a forced re-run", async () => {
    const c = await client();
    let runCount = 0;
    const fn = async () => {
      runCount += 1;
    };

    await runOnce(c, "forced", fn);
    await runOnce(c, "forced", fn, { force: true });

    expect(runCount).toBe(2);
  });

  it("records a failed run with the error, and does not silently swallow the error", async () => {
    const c = await client();

    await expect(
      runOnce(c, "will-fail", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const row = await getScriptRun(c, "will-fail");
    expect(row?.status).toBe("failed");
    expect(row?.note).toBe("boom");
  });

  it("allows retrying a failed run without --force (it never completed)", async () => {
    const c = await client();
    let attempt = 0;

    await expect(
      runOnce(c, "flaky", async () => {
        attempt += 1;
        if (attempt === 1) throw new Error("transient");
      })
    ).rejects.toThrow("transient");

    await runOnce(c, "flaky", async () => {
      attempt += 1;
    });

    expect(attempt).toBe(2);
    const row = await getScriptRun(c, "flaky");
    expect(row?.status).toBe("completed");
  });

  it("tracks different scripts independently", async () => {
    const c = await client();
    await runOnce(c, "script-a", async () => undefined);

    // script-b has never run, so it must not be blocked by script-a's row.
    let ran = false;
    await runOnce(c, "script-b", async () => {
      ran = true;
    });

    expect(ran).toBe(true);
  });
});
