/**
 * In-memory stand-in for @vercel/postgres used by the Mux webhook,
 * reconciliation, scheduled-job and custodial-key tests.
 *
 * It models only the tables and statements those modules issue, with the
 * semantics that matter for their guarantees:
 *   - transactions: BEGIN snapshots state, ROLLBACK restores it, and
 *     transactions are serialized (one "connection" at a time), which is how
 *     concurrent duplicate deliveries behave once Postgres' unique-index
 *     locking has ordered them;
 *   - NOW() is fixed per transaction, like Postgres;
 *   - the users.live_state_changed_at trigger;
 *   - mux_webhook_events primary-key conflicts.
 * Any statement it does not recognise throws, so a test can never pass by
 * silently ignoring SQL.
 *
 * Usage:
 *   jest.mock("@vercel/postgres", () =>
 *     jest.requireActual("@/testing/fake-postgres").vercelPostgresMock
 *   );
 */

type Params = unknown[];
type Row = Record<string, unknown>;
type Result = { rows: Row[]; rowCount: number };

export interface FakeUser {
  id: string;
  wallet?: string | null;
  mux_stream_id?: string | null;
  mux_playback_id?: string | null;
  creator?: { title?: string; streamTitle?: string } | null;
  is_live?: boolean | null;
  is_banned?: boolean | null;
  stream_started_at?: Date | null;
  current_viewers?: number;
  live_state_changed_at?: Date | null;
  updated_at?: Date | null;
  notifications?: unknown[];
  encrypted_stellar_key?: string | null;
  encrypted_stellar_key_legacy?: string | null;
  custodial_key_migrated_at?: Date | null;
}

export interface FakeSession {
  id: string;
  user_id: string;
  title: string | null;
  playback_id: string | null;
  mux_session_id: string | null;
  started_at: Date;
  ended_at: Date | null;
}

export interface FakeState {
  users: Map<string, FakeUser>;
  stream_sessions: FakeSession[];
  stream_recordings: Map<string, Row>;
  mux_webhook_events: Map<string, Row>;
  scheduled_job_runs: Map<string, Row>;
  custodial_key_migration_events: Row[];
}

function emptyState(): FakeState {
  return {
    users: new Map(),
    stream_sessions: [],
    stream_recordings: new Map(),
    mux_webhook_events: new Map(),
    scheduled_job_runs: new Map(),
    custodial_key_migration_events: [],
  };
}

function clone(state: FakeState): FakeState {
  return {
    users: new Map([...state.users].map(([k, v]) => [k, structuredClone(v)])),
    stream_sessions: state.stream_sessions.map(s => ({ ...s })),
    stream_recordings: new Map(
      [...state.stream_recordings].map(([k, v]) => [k, { ...v }])
    ),
    mux_webhook_events: new Map(
      [...state.mux_webhook_events].map(([k, v]) => [k, { ...v }])
    ),
    scheduled_job_runs: new Map(
      [...state.scheduled_job_runs].map(([k, v]) => [k, { ...v }])
    ),
    custodial_key_migration_events: state.custodial_key_migration_events.map(
      e => ({ ...e })
    ),
  };
}

const norm = (text: string) => text.replace(/\s+/g, " ").trim();
const days = (n: unknown) => Number(n) * 86_400_000;

type Rule = {
  pattern: RegExp;
  run: (p: Params, now: Date) => Result;
};

export class FakePostgres {
  state: FakeState = emptyState();
  /** Wall clock used for statements outside a transaction. */
  clock = new Date("2026-09-25T12:00:00Z");
  statements: string[] = [];
  private failures: Array<{ pattern: RegExp; error: Error; times: number }> =
    [];
  private lock: Promise<void> = Promise.resolve();
  private seq = 0;
  private rules: Rule[] = [];

  constructor() {
    this.installRules();
  }

  reset() {
    this.state = emptyState();
    this.clock = new Date("2026-09-25T12:00:00Z");
    this.statements = [];
    this.failures = [];
    this.lock = Promise.resolve();
  }

  advance(ms: number) {
    this.clock = new Date(this.clock.getTime() + ms);
  }

  addUser(user: FakeUser): FakeUser {
    const full: FakeUser = {
      is_live: false,
      is_banned: false,
      current_viewers: 0,
      live_state_changed_at: null,
      notifications: [],
      creator: {},
      ...user,
    };
    this.state.users.set(user.id, full);
    return full;
  }

  user(id: string): FakeUser {
    const u = this.state.users.get(id);
    if (!u) {
      throw new Error(`fake: no user ${id}`);
    }
    return u;
  }

  openSessions(userId: string): FakeSession[] {
    return this.state.stream_sessions.filter(
      s => s.user_id === userId && s.ended_at === null
    );
  }

  /** Makes the next `times` statements matching `pattern` throw `error`. */
  failOn(pattern: RegExp, error: Error, times = 1) {
    this.failures.push({ pattern, error, times });
  }

  private async acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>(r => (release = r));
    const prev = this.lock;
    this.lock = prev.then(() => next);
    await prev;
    return release;
  }

  private execute(text: string, params: Params, now: Date): Result {
    const sqlText = norm(text);
    this.statements.push(sqlText);
    const failure = this.failures.find(f => f.pattern.test(sqlText));
    if (failure) {
      failure.times--;
      if (failure.times <= 0) {
        this.failures.splice(this.failures.indexOf(failure), 1);
      }
      throw failure.error;
    }
    const rule = this.rules.find(r => r.pattern.test(sqlText));
    if (!rule) {
      throw new Error(`fake-postgres: unsupported statement: ${sqlText}`);
    }
    return rule.run(params, now);
  }

  /** Module-level `sql` tag: each statement runs on its own. */
  async query(text: string, params: Params): Promise<Result> {
    const release = await this.acquire();
    try {
      return this.execute(text, params, new Date(this.clock));
    } finally {
      release();
    }
  }

  /** `db.connect()`: a serialized connection with real rollback. */
  async connect() {
    const release = await this.acquire();
    let snapshot: FakeState | null = null;
    let txNow = new Date(this.clock);
    const run = async (text: string, params: Params): Promise<Result> => {
      const t = norm(text);
      if (t === "BEGIN") {
        snapshot = clone(this.state);
        txNow = new Date(this.clock);
        this.statements.push(t);
        return { rows: [], rowCount: 0 };
      }
      if (t === "COMMIT") {
        snapshot = null;
        this.statements.push(t);
        return { rows: [], rowCount: 0 };
      }
      if (t === "ROLLBACK") {
        if (snapshot) {
          this.state = snapshot;
        }
        snapshot = null;
        this.statements.push(t);
        return { rows: [], rowCount: 0 };
      }
      // Yield so "concurrent" callers genuinely interleave at await points.
      await Promise.resolve();
      return this.execute(
        text,
        params,
        snapshot ? txNow : new Date(this.clock)
      );
    };
    let released = false;
    return {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
        run(toText(strings), values),
      release: () => {
        if (!released) {
          released = true;
          release();
        }
      },
    };
  }

  private setLive(u: FakeUser, live: boolean, now: Date) {
    if (Boolean(u.is_live) !== live) {
      u.live_state_changed_at = now; // trg_users_live_state_changed_at
    }
    u.is_live = live;
    u.stream_started_at = live ? now : null;
    u.current_viewers = 0;
    u.updated_at = now;
  }

  private installRules() {
    const rule = (pattern: RegExp, run: Rule["run"]) =>
      this.rules.push({ pattern, run });
    const rows = (r: Row[]): Result => ({ rows: r, rowCount: r.length });

    // ── misc ────────────────────────────────────────────────────────────
    rule(/^SELECT set_config\('lock_timeout'/, () => rows([]));
    rule(/^SELECT NOW\(\)::text AS now$/, (_p, now) =>
      rows([{ now: now.toISOString() }])
    );

    // ── mux_webhook_events ──────────────────────────────────────────────
    rule(/^INSERT INTO mux_webhook_events .* 'processed', 1,/, (p, now) => {
      const [eventId, type, objectId, endpoint, createdAt] = p;
      const existing = this.state.mux_webhook_events.get(String(eventId));
      if (!existing) {
        this.state.mux_webhook_events.set(String(eventId), {
          event_id: eventId,
          event_type: type,
          object_id: objectId,
          endpoint,
          status: "processed",
          attempts: 1,
          event_created_at: createdAt,
          received_at: now,
          processed_at: now,
          last_error: null,
        });
        return rows([{ attempts: 1 }]);
      }
      if (existing.status !== "failed") {
        return rows([]);
      }
      existing.status = "processed";
      existing.attempts = Number(existing.attempts) + 1;
      existing.endpoint = endpoint;
      existing.last_error = null;
      existing.processed_at = now;
      return rows([{ attempts: existing.attempts }]);
    });
    rule(/^INSERT INTO mux_webhook_events .* 'failed', 1,/, (p, now) => {
      const [eventId, type, objectId, endpoint, error, createdAt] = p;
      const existing = this.state.mux_webhook_events.get(String(eventId));
      if (!existing) {
        this.state.mux_webhook_events.set(String(eventId), {
          event_id: eventId,
          event_type: type,
          object_id: objectId,
          endpoint,
          status: "failed",
          attempts: 1,
          last_error: error,
          event_created_at: createdAt,
          received_at: now,
          processed_at: null,
        });
        return rows([{ attempts: 1 }]);
      }
      if (existing.status !== "failed") {
        return rows([]);
      }
      existing.attempts = Number(existing.attempts) + 1;
      existing.last_error = error;
      return rows([{ attempts: existing.attempts }]);
    });
    rule(/^DELETE FROM mux_webhook_events WHERE event_id IN/, (p, now) => {
      const [retention, failedRetention, limit] = p;
      const victims = [...this.state.mux_webhook_events.values()]
        .filter(e =>
          e.status === "processed"
            ? now.getTime() -
                ((e.processed_at ?? e.received_at) as Date).getTime() >
              days(retention)
            : now.getTime() - (e.received_at as Date).getTime() >
              days(failedRetention)
        )
        .slice(0, Number(limit));
      for (const v of victims) {
        this.state.mux_webhook_events.delete(String(v.event_id));
      }
      return { rows: [], rowCount: victims.length };
    });

    // ── users live state (webhooks) ─────────────────────────────────────
    rule(
      /^UPDATE users SET is_live = (true|false), stream_started_at = (CURRENT_TIMESTAMP|NULL), current_viewers = 0, updated_at = CURRENT_TIMESTAMP WHERE mux_stream_id = \$1 RETURNING/,
      (p, now) => {
        const live = /is_live = true/.test(this.statements.at(-1) ?? "");
        const hits = [...this.state.users.values()].filter(
          u => u.mux_stream_id === p[0]
        );
        for (const u of hits) {
          this.setLive(u, live, now);
        }
        return rows(
          hits.map(u => ({
            id: u.id,
            mux_stream_id: u.mux_stream_id,
            mux_playback_id: u.mux_playback_id,
            creator: u.creator,
          }))
        );
      }
    );

    // ── users live state (reconciliation) ───────────────────────────────
    const guardOk = (u: FakeUser, observedAt: unknown, grace: unknown) =>
      !u.live_state_changed_at ||
      u.live_state_changed_at.getTime() <
        new Date(String(observedAt)).getTime() - Number(grace) * 1000;
    rule(
      /^UPDATE users SET is_live = false, .* WHERE id = \$1 AND is_live = true AND mux_stream_id IS NOT DISTINCT FROM \$2 AND \(live_state_changed_at IS NULL OR live_state_changed_at < \$3::timestamptz - make_interval\(secs => \$4\)\) RETURNING id$/,
      (p, now) => {
        const u = this.state.users.get(String(p[0]));
        if (
          !u ||
          u.is_live !== true ||
          (u.mux_stream_id ?? null) !== (p[1] ?? null) ||
          !guardOk(u, p[2], p[3])
        ) {
          return rows([]);
        }
        this.setLive(u, false, now);
        return rows([{ id: u.id }]);
      }
    );
    rule(
      /^UPDATE users SET is_live = true, .* WHERE id = \$1 AND COALESCE\(is_live, false\) = false AND COALESCE\(is_banned, false\) = false AND mux_stream_id = \$2 AND \(live_state_changed_at IS NULL OR live_state_changed_at < \$3::timestamptz - make_interval\(secs => \$4\)\) RETURNING id, mux_stream_id, mux_playback_id, creator$/,
      (p, now) => {
        const u = this.state.users.get(String(p[0]));
        if (
          !u ||
          u.is_live === true ||
          u.is_banned === true ||
          u.mux_stream_id !== p[1] ||
          !guardOk(u, p[2], p[3])
        ) {
          return rows([]);
        }
        this.setLive(u, true, now);
        return rows([
          {
            id: u.id,
            mux_stream_id: u.mux_stream_id,
            mux_playback_id: u.mux_playback_id,
            creator: u.creator,
          },
        ]);
      }
    );
    rule(
      /^SELECT id, mux_stream_id, live_state_changed_at::text AS live_state_changed_at FROM users WHERE is_live = true$/,
      () =>
        rows(
          [...this.state.users.values()]
            .filter(u => u.is_live === true)
            .map(u => ({
              id: u.id,
              mux_stream_id: u.mux_stream_id ?? null,
              live_state_changed_at:
                u.live_state_changed_at?.toISOString() ?? null,
            }))
        )
    );
    rule(
      /^SELECT id, mux_stream_id, is_banned, live_state_changed_at::text AS live_state_changed_at FROM users WHERE mux_stream_id IN \( SELECT jsonb_array_elements_text\(\$1::jsonb\) \) AND COALESCE\(is_live, false\) = false$/,
      p => {
        const ids = new Set(JSON.parse(String(p[0])) as string[]);
        return rows(
          [...this.state.users.values()]
            .filter(
              u => u.mux_stream_id && ids.has(u.mux_stream_id) && !u.is_live
            )
            .map(u => ({
              id: u.id,
              mux_stream_id: u.mux_stream_id,
              is_banned: u.is_banned ?? false,
              live_state_changed_at:
                u.live_state_changed_at?.toISOString() ?? null,
            }))
        );
      }
    );

    // ── stream_sessions ─────────────────────────────────────────────────
    rule(
      /^INSERT INTO stream_sessions .* WHERE NOT EXISTS .* RETURNING id$/,
      (p, now) => {
        const [userId, title, playbackId, muxSessionId] = p;
        if (this.openSessions(String(userId)).length > 0) {
          return rows([]);
        }
        const session: FakeSession = {
          id: `session-${++this.seq}`,
          user_id: String(userId),
          title: title as string,
          playback_id: playbackId as string,
          mux_session_id: muxSessionId as string,
          started_at: now,
          ended_at: null,
        };
        this.state.stream_sessions.push(session);
        return rows([{ id: session.id }]);
      }
    );
    rule(
      /^UPDATE stream_sessions SET ended_at = CURRENT_TIMESTAMP WHERE user_id = \$1 AND ended_at IS NULL$/,
      (p, now) => {
        const open = this.openSessions(String(p[0]));
        for (const s of open) {
          s.ended_at = now;
        }
        return { rows: [], rowCount: open.length };
      }
    );
    rule(
      /^SELECT id FROM stream_sessions WHERE user_id = \$1 AND ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1$/,
      p =>
        rows(
          this.state.stream_sessions
            .filter(s => s.user_id === p[0] && s.ended_at)
            .sort((a, b) => b.ended_at!.getTime() - a.ended_at!.getTime())
            .slice(0, 1)
            .map(s => ({ id: s.id }))
        )
    );

    // ── recordings + notifications ──────────────────────────────────────
    rule(/^SELECT id, creator FROM users WHERE mux_stream_id = \$1$/, p =>
      rows(
        [...this.state.users.values()]
          .filter(u => u.mux_stream_id === p[0])
          .map(u => ({ id: u.id, creator: u.creator }))
      )
    );
    rule(/^INSERT INTO stream_recordings/, p => {
      const [userId, sessionId, assetId, playbackId, title, duration] = p;
      const existing = this.state.stream_recordings.get(String(assetId));
      if (existing) {
        existing.status = "ready";
        existing.duration = duration ?? existing.duration;
        existing.playback_id = playbackId;
      } else {
        this.state.stream_recordings.set(String(assetId), {
          user_id: userId,
          stream_session_id: sessionId,
          mux_asset_id: assetId,
          playback_id: playbackId,
          title,
          duration,
          status: "ready",
          needs_review: true,
        });
      }
      return { rows: [], rowCount: 1 };
    });
    rule(
      /^UPDATE stream_recordings SET status = 'error' WHERE mux_asset_id = \$1 RETURNING user_id$/,
      p => {
        const r = this.state.stream_recordings.get(String(p[0]));
        if (!r) {
          return rows([]);
        }
        r.status = "error";
        return rows([{ user_id: r.user_id }]);
      }
    );
    rule(/^DELETE FROM stream_recordings WHERE mux_asset_id = \$1$/, p => {
      const had = this.state.stream_recordings.delete(String(p[0]));
      return { rows: [], rowCount: had ? 1 : 0 };
    });
    rule(/^UPDATE users SET notifications = /, p => {
      const u = this.state.users.get(String(p[1]));
      if (!u) {
        return { rows: [], rowCount: 0 };
      }
      u.notifications = [...(u.notifications ?? []), JSON.parse(String(p[0]))];
      return { rows: [], rowCount: 1 };
    });

    // ── scheduled_job_runs ──────────────────────────────────────────────
    rule(/^INSERT INTO scheduled_job_runs/, (p, now) => {
      const [name, owner, leaseSeconds] = p;
      const job = this.state.scheduled_job_runs.get(String(name));
      if (
        job &&
        job.lease_expires_at &&
        (job.lease_expires_at as Date).getTime() >= now.getTime()
      ) {
        return rows([]);
      }
      this.state.scheduled_job_runs.set(String(name), {
        consecutive_failures: 0,
        consecutive_drift_runs: 0,
        ...job,
        job_name: name,
        lease_owner: owner,
        lease_expires_at: new Date(now.getTime() + Number(leaseSeconds) * 1000),
        last_started_at: now,
      });
      return rows([{ job_name: name }]);
    });
    rule(
      /^UPDATE scheduled_job_runs SET lease_owner = NULL, .* last_succeeded_at = NOW\(\)/,
      (p, now) => {
        const [drift, summary, name, owner] = p;
        const job = this.state.scheduled_job_runs.get(String(name));
        if (!job || job.lease_owner !== owner) {
          return rows([]);
        }
        Object.assign(job, {
          lease_owner: null,
          lease_expires_at: null,
          last_finished_at: now,
          last_succeeded_at: now,
          last_error: null,
          consecutive_failures: 0,
          consecutive_drift_runs: drift
            ? Number(job.consecutive_drift_runs) + 1
            : 0,
          last_summary: JSON.parse(String(summary)),
        });
        return rows([{ consecutive_drift_runs: job.consecutive_drift_runs }]);
      }
    );
    rule(
      /^UPDATE scheduled_job_runs SET lease_owner = CASE WHEN \$1/,
      (p, now) => {
        const [release, , message, name, owner] = p;
        const job = this.state.scheduled_job_runs.get(String(name));
        if (!job) {
          return rows([]);
        }
        const expired =
          job.lease_expires_at &&
          (job.lease_expires_at as Date).getTime() < now.getTime();
        if (
          !(job.lease_owner === owner || job.lease_owner === null || expired)
        ) {
          return rows([]);
        }
        if (release) {
          job.lease_owner = null;
          job.lease_expires_at = null;
        }
        Object.assign(job, {
          last_finished_at: now,
          last_failed_at: now,
          last_error: message,
          consecutive_failures: Number(job.consecutive_failures) + 1,
        });
        return rows([{ consecutive_failures: job.consecutive_failures }]);
      }
    );
    rule(
      /^SELECT \(last_succeeded_at IS NULL OR last_succeeded_at < NOW\(\) - make_interval\(secs => \$1\)\) AS stale/,
      (p, now) => {
        const job = this.state.scheduled_job_runs.get(String(p[1]));
        if (!job) {
          return rows([]);
        }
        const last = job.last_succeeded_at as Date | undefined;
        return rows([
          {
            stale:
              !last || last.getTime() < now.getTime() - Number(p[0]) * 1000,
            last_succeeded_at: last ?? null,
          },
        ]);
      }
    );

    // ── custodial keys ──────────────────────────────────────────────────
    const byId = (a: FakeUser, b: FakeUser) => a.id.localeCompare(b.id);
    rule(
      /^SELECT id, wallet, encrypted_stellar_key FROM users WHERE encrypted_stellar_key IS NOT NULL AND encrypted_stellar_key NOT LIKE \$1 AND id > \$2::uuid ORDER BY id LIMIT \$3$/,
      p => {
        const prefix = String(p[0]).replace(/%$/, "");
        return rows(
          [...this.state.users.values()]
            .filter(
              u =>
                u.encrypted_stellar_key &&
                !u.encrypted_stellar_key.startsWith(prefix) &&
                u.id > String(p[1])
            )
            .sort(byId)
            .slice(0, Number(p[2]))
            .map(u => ({
              id: u.id,
              wallet: u.wallet ?? null,
              encrypted_stellar_key: u.encrypted_stellar_key,
            }))
        );
      }
    );
    rule(
      /^SELECT id, wallet, encrypted_stellar_key, encrypted_stellar_key_legacy FROM users WHERE encrypted_stellar_key LIKE \$1 AND \(\$2 OR encrypted_stellar_key_legacy IS NOT NULL\) AND id > \$3::uuid ORDER BY id LIMIT \$4$/,
      p => {
        const prefix = String(p[0]).replace(/%$/, "");
        return rows(
          [...this.state.users.values()]
            .filter(
              u =>
                u.encrypted_stellar_key?.startsWith(prefix) &&
                (p[1] === true || u.encrypted_stellar_key_legacy) &&
                u.id > String(p[2])
            )
            .sort(byId)
            .slice(0, Number(p[3]))
            .map(u => ({
              id: u.id,
              wallet: u.wallet ?? null,
              encrypted_stellar_key: u.encrypted_stellar_key,
              encrypted_stellar_key_legacy:
                u.encrypted_stellar_key_legacy ?? null,
            }))
        );
      }
    );
    rule(
      /^SELECT COUNT\(\*\)::text AS count FROM users WHERE encrypted_stellar_key IS NOT NULL AND encrypted_stellar_key NOT LIKE \$1$/,
      p => {
        const prefix = String(p[0]).replace(/%$/, "");
        const n = [...this.state.users.values()].filter(
          u =>
            u.encrypted_stellar_key &&
            !u.encrypted_stellar_key.startsWith(prefix)
        ).length;
        return rows([{ count: String(n) }]);
      }
    );
    rule(
      /^UPDATE users SET encrypted_stellar_key = \$1, encrypted_stellar_key_legacy = \$2, custodial_key_migrated_at = NOW\(\) WHERE id = \$3 AND encrypted_stellar_key = \$4 RETURNING id$/,
      (p, now) => {
        const u = this.state.users.get(String(p[2]));
        if (!u || u.encrypted_stellar_key !== p[3]) {
          return rows([]);
        }
        u.encrypted_stellar_key = String(p[0]);
        u.encrypted_stellar_key_legacy = String(p[1]);
        u.custodial_key_migrated_at = now;
        return rows([{ id: u.id }]);
      }
    );
    rule(
      /^UPDATE users SET encrypted_stellar_key_legacy = NULL WHERE id = \$1 AND encrypted_stellar_key = \$2 RETURNING id$/,
      p => {
        const u = this.state.users.get(String(p[0]));
        if (!u || u.encrypted_stellar_key !== p[1]) {
          return rows([]);
        }
        u.encrypted_stellar_key_legacy = null;
        return rows([{ id: u.id }]);
      }
    );
    rule(/^INSERT INTO custodial_key_migration_events/, (p, now) => {
      const [run_id, user_id, mode, outcome, reason, kms_key_id] = p;
      this.state.custodial_key_migration_events.push({
        run_id,
        user_id,
        mode,
        outcome,
        reason,
        kms_key_id,
        created_at: now,
      });
      return { rows: [], rowCount: 1 };
    });
  }
}

export function toText(strings: TemplateStringsArray | string[]): string {
  return strings.reduce((acc, s, i) => `${acc}$${i}${s}`);
}

export const fakePostgres = new FakePostgres();

export const vercelPostgresMock = {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    fakePostgres.query(toText(strings), values),
  db: {
    connect: () => fakePostgres.connect(),
  },
};
