/**
 * PostgreSQL-backed idempotency store (#1401). See the idempotency_keys
 * migration for the schema and docs/idempotency.md for the contract.
 */
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";

export interface ClaimRequest {
  userId: string;
  scope: string;
  key: string;
  fingerprint: string;
  ttlSeconds: number;
  leaseSeconds: number;
}

export type ClaimResult =
  /** This request owns the operation and must run it. */
  | { kind: "claimed"; id: string; attempt: number; recovered: boolean }
  /** The operation already finished: return its stored response. */
  | { kind: "replay"; status: number; body: unknown }
  /** Another request holding the key is still running. */
  | { kind: "in_flight" }
  /** The key was used for a different request. */
  | { kind: "mismatch" };

const MAX_CLAIM_ROUNDS = 5;

/**
 * Atomically claims (user, scope, key). The unique constraint guarantees a
 * single winner among concurrent first attempts; the conditional UPDATEs
 * guarantee a single winner when taking over a crashed attempt or reusing an
 * expired key.
 */
export async function claimIdempotencyKey(
  request: ClaimRequest,
  executor: SqlExecutor = defaultExecutor
): Promise<ClaimResult> {
  const { userId, scope, key, fingerprint, ttlSeconds, leaseSeconds } = request;

  for (let round = 0; round < MAX_CLAIM_ROUNDS; round++) {
    const inserted = await executor(
      `INSERT INTO idempotency_keys
         (user_id, scope, idempotency_key, request_fingerprint, status,
          locked_until, expires_at)
       VALUES ($1, $2, $3, $4, 'processing',
               NOW() + make_interval(secs => $5::double precision),
               NOW() + make_interval(secs => $6::double precision))
       ON CONFLICT (user_id, scope, idempotency_key) DO NOTHING
       RETURNING id`,
      [userId, scope, key, fingerprint, leaseSeconds, ttlSeconds]
    );
    if (inserted.rows[0]) {
      return {
        kind: "claimed",
        id: inserted.rows[0].id,
        attempt: 1,
        recovered: false,
      };
    }

    const { rows } = await executor(
      `SELECT id, request_fingerprint, status, response_status, response_body,
              locked_until > NOW() AS lease_active,
              expires_at <= NOW() AS expired
         FROM idempotency_keys
        WHERE user_id = $1 AND scope = $2 AND idempotency_key = $3`,
      [userId, scope, key]
    );
    const existing = rows[0];
    if (!existing) {
      continue; // purged between the insert and the read; try again
    }

    if (existing.status === "completed" && existing.expired) {
      // Past its retention window the key may start a new operation.
      const reused = await executor(
        `UPDATE idempotency_keys
            SET id = gen_random_uuid(), request_fingerprint = $2,
                status = 'processing', attempts = 1,
                locked_until = NOW() + make_interval(secs => $3::double precision),
                expires_at = NOW() + make_interval(secs => $4::double precision),
                response_status = NULL, response_body = NULL,
                created_at = NOW(), completed_at = NULL
          WHERE id = $1 AND status = 'completed' AND expires_at <= NOW()
         RETURNING id`,
        [existing.id, fingerprint, leaseSeconds, ttlSeconds]
      );
      if (reused.rows[0]) {
        return {
          kind: "claimed",
          id: reused.rows[0].id,
          attempt: 1,
          recovered: false,
        };
      }
      continue;
    }

    if (String(existing.request_fingerprint).trim() !== fingerprint) {
      return { kind: "mismatch" };
    }

    if (existing.status === "completed") {
      return {
        kind: "replay",
        status: Number(existing.response_status),
        body: existing.response_body,
      };
    }

    if (existing.lease_active) {
      return { kind: "in_flight" };
    }

    // The previous owner's lease lapsed without completing: it crashed or
    // timed out. Exactly one retry takes over and re-runs the operation, which
    // must itself recognise work already done for this id.
    const takeover = await executor(
      `UPDATE idempotency_keys
          SET locked_until = NOW() + make_interval(secs => $2::double precision),
              attempts = attempts + 1
        WHERE id = $1 AND status = 'processing' AND locked_until <= NOW()
       RETURNING id, attempts`,
      [existing.id, leaseSeconds]
    );
    if (takeover.rows[0]) {
      return {
        kind: "claimed",
        id: takeover.rows[0].id,
        attempt: Number(takeover.rows[0].attempts),
        recovered: true,
      };
    }
  }

  return { kind: "in_flight" };
}

export async function completeIdempotencyKey(
  id: string,
  status: number,
  body: unknown,
  executor: SqlExecutor = defaultExecutor
): Promise<void> {
  await executor(
    `UPDATE idempotency_keys
        SET status = 'completed', response_status = $2,
            response_body = $3::jsonb, completed_at = NOW()
      WHERE id = $1 AND status = 'processing'`,
    [id, status, JSON.stringify(body ?? null)]
  );
}

/** Gives the key back so a retry can run the operation again. */
export async function releaseIdempotencyKey(
  id: string,
  executor: SqlExecutor = defaultExecutor
): Promise<void> {
  await executor(
    `DELETE FROM idempotency_keys WHERE id = $1 AND status = 'processing'`,
    [id]
  );
}

/**
 * Deletes expired keys in bounded batches. A processing row is only removed
 * once both its retention window and its lease have lapsed, so an operation
 * that is still running can never lose its key.
 */
export async function purgeExpiredIdempotencyKeys(
  options: { batchSize?: number; maxBatches?: number } = {},
  executor: SqlExecutor = defaultExecutor
): Promise<number> {
  const batchSize = options.batchSize ?? 1000;
  const maxBatches = options.maxBatches ?? 20;
  let total = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const { rowCount } = await executor(
      `DELETE FROM idempotency_keys
        WHERE id IN (
          SELECT id FROM idempotency_keys
           WHERE expires_at <= NOW()
             AND (status = 'completed' OR locked_until <= NOW())
           LIMIT $1
        )`,
      [batchSize]
    );
    total += rowCount;
    if (rowCount < batchSize) {
      break;
    }
  }
  return total;
}
