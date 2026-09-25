/**
 * Route-level Idempotency-Key handling (#1401). A payment-adjacent route
 * authenticates, validates its body, then hands the side-effecting part to
 * `executeIdempotent`:
 *
 *   return executeIdempotent(req, {
 *     userId: session.userId,
 *     ...IDEMPOTENT_OPERATIONS.payoutCreate,
 *     request: body,
 *   }, async ({ idempotencyRef }) => { ...side effects...; return NextResponse.json(...) });
 *
 * See docs/idempotency.md for the full contract.
 */
import { NextResponse } from "next/server";
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";
import { logger } from "@/lib/tracing/logger";
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  requestFingerprint,
  validateIdempotencyKey,
} from "./key";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
} from "./store";

export interface IdempotentOperation {
  /** Operation type; keys never collide across scopes. */
  scope: string;
  /** How long a completed response is replayed. */
  ttlSeconds: number;
  /** How long the running request owns the key before a retry may take over. */
  leaseSeconds: number;
}

const DAY = 24 * 60 * 60;

/** Registry of protected operations; new financial routes add an entry. */
export const IDEMPOTENT_OPERATIONS = {
  subscriptionCreate: {
    scope: "subscription.create",
    ttlSeconds: DAY,
    leaseSeconds: 60,
  },
  subscriptionRenew: {
    scope: "subscription.renew",
    ttlSeconds: DAY,
    leaseSeconds: 60,
  },
  // Manual payouts stay pending for days; keep keys for the whole window.
  payoutCreate: {
    scope: "payout.create",
    ttlSeconds: 7 * DAY,
    leaseSeconds: 60,
  },
} satisfies Record<string, IdempotentOperation>;

export interface ExecuteOptions extends IdempotentOperation {
  userId: string;
  /** Validated request payload; hashed to detect key reuse. */
  request: unknown;
  /** How long a duplicate waits for an in-flight original before 409. */
  waitForInFlightMs?: number;
  executor?: SqlExecutor;
}

export interface OperationContext {
  /** Stable id of this idempotency record; persist it with side effects. */
  idempotencyRef: string;
  /** True when a retry took over an attempt that crashed mid-operation. */
  recovered: boolean;
}

function event(
  name: string,
  scope: string,
  extra: Record<string, unknown> = {}
) {
  logger.info("idempotency", { event: name, scope, ...extra });
}

function withKeyHeader(res: NextResponse, key: string): NextResponse {
  res.headers.set(IDEMPOTENCY_HEADER, key);
  return res;
}

export async function executeIdempotent(
  req: Request,
  options: ExecuteOptions,
  operation: (ctx: OperationContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const executor = options.executor ?? defaultExecutor;
  const validation = validateIdempotencyKey(
    req.headers.get(IDEMPOTENCY_HEADER)
  );
  if (!validation.ok) {
    event("rejected_key", options.scope, { reason: validation.error });
    return NextResponse.json(
      {
        error: validation.error,
        message: `Send a unique ${IDEMPOTENCY_HEADER} header (8-255 printable characters, e.g. a UUID) and reuse it when retrying.`,
      },
      { status: 400 }
    );
  }
  const key = validation.key;
  const claimRequest = {
    userId: options.userId,
    scope: options.scope,
    key,
    fingerprint: requestFingerprint(options.scope, options.request),
    ttlSeconds: options.ttlSeconds,
    leaseSeconds: options.leaseSeconds,
  };

  const deadline = Date.now() + (options.waitForInFlightMs ?? 3_000);
  let claim = await claimIdempotencyKey(claimRequest, executor);
  while (claim.kind === "in_flight" && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 200));
    claim = await claimIdempotencyKey(claimRequest, executor);
  }

  if (claim.kind === "mismatch") {
    event("mismatch", options.scope);
    return NextResponse.json(
      {
        error: "idempotency_key_reused",
        message: `This ${IDEMPOTENCY_HEADER} was already used for a different request.`,
      },
      { status: 422 }
    );
  }

  if (claim.kind === "in_flight") {
    event("in_flight", options.scope);
    return withKeyHeader(
      NextResponse.json(
        {
          error: "idempotency_request_in_progress",
          message:
            "The original request is still being processed; retry with the same key.",
        },
        { status: 409, headers: { "Retry-After": "1" } }
      ),
      key
    );
  }

  if (claim.kind === "replay") {
    event("replayed", options.scope, { status: claim.status });
    return withKeyHeader(
      NextResponse.json(claim.body, {
        status: claim.status,
        headers: { [IDEMPOTENCY_REPLAYED_HEADER]: "true" },
      }),
      key
    );
  }

  event(claim.recovered ? "recovered" : "claimed", options.scope, {
    attempt: claim.attempt,
  });

  let response: NextResponse;
  try {
    response = await operation({
      idempotencyRef: claim.id,
      recovered: claim.recovered,
    });
  } catch (error) {
    await releaseIdempotencyKey(claim.id, executor).catch(() => undefined);
    event("released", options.scope, { reason: "exception" });
    throw error;
  }

  // Server errors and rate limits are not final: free the key for a retry.
  if (response.status >= 500 || response.status === 429) {
    await releaseIdempotencyKey(claim.id, executor).catch(() => undefined);
    event("released", options.scope, { status: response.status });
    return withKeyHeader(response, key);
  }

  let body: unknown = null;
  try {
    body = await response.clone().json();
  } catch {
    body = null;
  }

  try {
    await completeIdempotencyKey(claim.id, response.status, body, executor);
  } catch (error) {
    // The side effect happened but the response was not stored. The row stays
    // processing; once its lease lapses a retry takes over and the operation
    // recovers its earlier result via idempotencyRef.
    logger.error("Failed to store idempotent response", {
      scope: options.scope,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
  return withKeyHeader(response, key);
}
