import { sql } from "@vercel/postgres";
import { sendOperationalAlert } from "@/lib/security/alerts";
import { logger } from "@/lib/tracing/logger";

export interface DeadLetterEmailRecord {
  id?: number;
  emailType: string;
  recipientEmail: string;
  subject: string;
  payload?: Record<string, unknown>;
  attempts: number;
  lastError: string;
  deadLetteredAt: string;
  resolvedAt?: string | null;
}

export interface TransactionalEmailRetryOptions {
  emailType: string;
  recipientEmail: string;
  subject: string;
  payload?: Record<string, unknown>;
  /** Number of retries after the initial attempt (default: 2 -> 3 total attempts). */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds before first retry (default: 250ms). */
  initialBackoffMs?: number;
  /** Multiplier for exponential backoff (default: 2). */
  backoffFactor?: number;
  /** Optional sleep override for unit tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface TransactionalEmailDeliveryResult<T = unknown> {
  success: boolean;
  attempts: number;
  result?: T;
  error?: string;
  deadLettered: boolean;
}

const MAX_IN_MEMORY_DEAD_LETTERS = 200;
const MAX_ERROR_LENGTH = 1_000;
const inMemoryDeadLetters: DeadLetterEmailRecord[] = [];

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Records a dead-lettered transactional email in the database
 * (`transactional_email_dead_letters`), an in-memory review buffer, structured
 * logs, and the operational alerting channel.
 *
 * Never throws so that dead-letter persistence cannot crash a caller.
 */
export async function recordEmailDeadLetter(input: {
  emailType: string;
  recipientEmail: string;
  subject: string;
  payload?: Record<string, unknown>;
  attempts: number;
  lastError: string;
}): Promise<DeadLetterEmailRecord> {
  const truncatedError = input.lastError.slice(0, MAX_ERROR_LENGTH);
  const nowIso = new Date().toISOString();
  const record: DeadLetterEmailRecord = {
    emailType: input.emailType,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    payload: input.payload ?? {},
    attempts: input.attempts,
    lastError: truncatedError,
    deadLetteredAt: nowIso,
    resolvedAt: null,
  };

  inMemoryDeadLetters.unshift(record);
  if (inMemoryDeadLetters.length > MAX_IN_MEMORY_DEAD_LETTERS) {
    inMemoryDeadLetters.pop();
  }

  try {
    const { rows } = await sql`
      INSERT INTO transactional_email_dead_letters (
        email_type,
        recipient_email,
        subject,
        payload,
        attempts,
        last_error
      )
      VALUES (
        ${record.emailType},
        ${record.recipientEmail},
        ${record.subject},
        ${JSON.stringify(record.payload ?? {})}::jsonb,
        ${record.attempts},
        ${record.lastError}
      )
      RETURNING id, dead_lettered_at
    `;
    if (rows?.[0]?.id !== undefined) {
      record.id = Number(rows[0].id);
    }
  } catch (dbErr) {
    logger.warn("transactional_email_dead_letter_db_persist_failed", {
      emailType: record.emailType,
      recipientEmail: record.recipientEmail,
      errorMessage: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }

  logger.error("transactional_email_dead_lettered", {
    emailType: record.emailType,
    recipientEmail: record.recipientEmail,
    subject: record.subject,
    attempts: record.attempts,
    errorMessage: record.lastError,
  });

  await sendOperationalAlert({
    category: "transactional_email",
    event: "transactional_email_dead_lettered",
    severity: "warning",
    title: `Transactional email failed after ${record.attempts} attempts (${record.emailType})`,
    dedupKey: `email_dlq:${record.emailType}:${record.recipientEmail}`,
    cooldownSeconds: 15 * 60,
    details: {
      email_type: record.emailType,
      recipient_email: record.recipientEmail,
      subject: record.subject,
      attempts: record.attempts,
      error: record.lastError.slice(0, 300),
    },
  }).catch(() => undefined);

  return record;
}

/**
 * Executes a transactional email delivery operation with exponential backoff
 * retries. If all attempts fail (or return `false`), records the failure in
 * the dead-letter store and returns a structured failure result without
 * throwing.
 */
export async function executeEmailWithRetryAndDeadLetter<T>(
  sendFn: (attempt: number) => Promise<T>,
  options: TransactionalEmailRetryOptions
): Promise<TransactionalEmailDeliveryResult<T>> {
  const maxRetries = options.maxRetries ?? 2;
  const initialBackoffMs = options.initialBackoffMs ?? 250;
  const backoffFactor = options.backoffFactor ?? 2;
  const sleep = options.sleep ?? defaultSleep;

  let lastError = "Email delivery failed";
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      const result = await sendFn(attempts);

      if (result === false) {
        throw new Error("Email transport returned false");
      }
      if (
        result &&
        typeof result === "object" &&
        "success" in result &&
        (result as { success?: unknown }).success === false
      ) {
        const errMsg =
          typeof (result as { error?: unknown }).error === "string"
            ? (result as { error: string }).error || "Email delivery failed"
            : "Email delivery returned success=false";
        throw new Error(errMsg);
      }

      if (attempt > 0) {
        logger.info("transactional_email_recovered_on_retry", {
          emailType: options.emailType,
          recipientEmail: options.recipientEmail,
          subject: options.subject,
          attempts,
        });
      }

      return {
        success: true,
        attempts,
        result,
        deadLettered: false,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);

      if (attempt < maxRetries) {
        const delayMs = initialBackoffMs * Math.pow(backoffFactor, attempt);
        logger.warn("transactional_email_attempt_failed_retrying", {
          emailType: options.emailType,
          recipientEmail: options.recipientEmail,
          subject: options.subject,
          attempt: attempts,
          maxAttempts: maxRetries + 1,
          retryInMs: delayMs,
          errorMessage: lastError,
        });
        await sleep(delayMs);
      }
    }
  }

  await recordEmailDeadLetter({
    emailType: options.emailType,
    recipientEmail: options.recipientEmail,
    subject: options.subject,
    payload: options.payload,
    attempts,
    lastError,
  });

  return {
    success: false,
    attempts,
    error: lastError,
    deadLettered: true,
  };
}

/**
 * Retrieves dead-lettered transactional emails for review (from the database
 * when available, falling back to the in-memory dead-letter buffer).
 */
export async function listEmailDeadLetters(
  options: {
    limit?: number;
    includeResolved?: boolean;
  } = {}
): Promise<DeadLetterEmailRecord[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  const includeResolved = options.includeResolved ?? false;

  try {
    const result = includeResolved
      ? await sql`
          SELECT
            id,
            email_type,
            recipient_email,
            subject,
            payload,
            attempts,
            last_error,
            dead_lettered_at,
            resolved_at
          FROM transactional_email_dead_letters
          ORDER BY dead_lettered_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT
            id,
            email_type,
            recipient_email,
            subject,
            payload,
            attempts,
            last_error,
            dead_lettered_at,
            resolved_at
          FROM transactional_email_dead_letters
          WHERE resolved_at IS NULL
          ORDER BY dead_lettered_at DESC
          LIMIT ${limit}
        `;

    if (result?.rows) {
      return result.rows.map((row: Record<string, unknown>) => ({
        id: Number(row.id),
        emailType: String(row.email_type),
        recipientEmail: String(row.recipient_email),
        subject: String(row.subject),
        payload:
          row.payload && typeof row.payload === "object"
            ? (row.payload as Record<string, unknown>)
            : {},
        attempts: Number(row.attempts),
        lastError: String(row.last_error),
        deadLetteredAt:
          row.dead_lettered_at instanceof Date
            ? row.dead_lettered_at.toISOString()
            : String(row.dead_lettered_at),
        resolvedAt:
          row.resolved_at instanceof Date
            ? row.resolved_at.toISOString()
            : row.resolved_at
              ? String(row.resolved_at)
              : null,
      }));
    }
  } catch {
    // Fall back to in-memory buffer when DB is unavailable or in unit tests
  }

  const filtered = includeResolved
    ? inMemoryDeadLetters
    : inMemoryDeadLetters.filter(r => !r.resolvedAt);
  return filtered.slice(0, limit);
}

export function getInMemoryEmailDeadLetters(): DeadLetterEmailRecord[] {
  return [...inMemoryDeadLetters];
}

export function clearInMemoryEmailDeadLettersForTests(): void {
  inMemoryDeadLetters.length = 0;
}
