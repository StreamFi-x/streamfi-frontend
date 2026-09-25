import { logger } from "@/lib/tracing/logger";
import {
  MemoryKvStore,
  getSecurityKvStore,
  type SecurityKvStore,
} from "@/lib/security/kv-store";

/**
 * Operational/security alerting shared by admin auth throttling, Mux
 * reconciliation and custodial-key operations.
 *
 * Delivery: every alert is written as a structured log line
 * (`operational_alert`). When OPS_ALERT_WEBHOOK_URL is set, it is also POSTed
 * as `{ text }` — the payload shape accepted by Slack and Discord incoming
 * webhooks.
 *
 * Flood control (an attacker must not be able to turn alerting into a spam
 * channel):
 *   1. De-duplication — alerts sharing a `dedupKey` are sent at most once per
 *      `cooldownSeconds`.
 *   2. Per-category hourly budget — at most OPS_ALERT_HOURLY_BUDGET
 *      (default 20) alerts per category per clock hour are delivered, no
 *      matter how many distinct dedup keys an attacker manufactures (e.g. by
 *      rotating IPs). Suppressed alerts are still logged.
 */

export type AlertCategory =
  | "admin_auth"
  | "mux_reconciliation"
  | "mux_webhooks"
  | "custodial_keys";

export type AlertSeverity = "warning" | "critical";

export type AlertDetailValue = string | number | boolean | null;

export interface OperationalAlert {
  category: AlertCategory;
  /** Stable machine-readable event name, e.g. "admin_auth_alerted". */
  event: string;
  severity: AlertSeverity;
  title: string;
  dedupKey: string;
  cooldownSeconds: number;
  details: Record<string, AlertDetailValue>;
}

export type AlertOutcome = "sent" | "logged" | "deduplicated" | "suppressed";

const DEFAULT_HOURLY_BUDGET = 20;
const DELIVERY_TIMEOUT_MS = 3_000;
const SENSITIVE_KEY =
  /(secret|token|password|cookie|authorization|seed|private|credential)/i;

const fallbackStore = new MemoryKvStore();

function hourlyBudget(): number {
  const parsed = Number(process.env.OPS_ALERT_HOURLY_BUDGET);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_HOURLY_BUDGET;
}

/** Defence in depth: never forward anything that looks like a secret. */
export function redactAlertDetails(
  details: Record<string, AlertDetailValue>
): Record<string, AlertDetailValue> {
  const out: Record<string, AlertDetailValue> = {};
  for (const [key, value] of Object.entries(details)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : value;
  }
  return out;
}

function environmentName(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
}

async function gate(
  store: SecurityKvStore,
  alert: OperationalAlert
): Promise<"deliver" | "deduplicated" | "suppressed"> {
  const fresh = await store.setIfAbsent(
    `ops-alert:dedup:${alert.dedupKey}`,
    "1",
    alert.cooldownSeconds * 1000
  );
  if (!fresh) {
    return "deduplicated";
  }
  const hour = Math.floor(Date.now() / 3_600_000);
  const used = await store.incrWithTtl(
    `ops-alert:budget:${alert.category}:${hour}`,
    3_600_000
  );
  return used > hourlyBudget() ? "suppressed" : "deliver";
}

function formatText(
  alert: OperationalAlert,
  details: Record<string, AlertDetailValue>
): string {
  const lines = Object.entries(details).map(([k, v]) => `• ${k}: ${v}`);
  return [
    `[${alert.severity.toUpperCase()}] ${alert.title}`,
    `env: ${environmentName()} · event: ${alert.event}`,
    ...lines,
  ].join("\n");
}

async function deliver(url: string, text: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`alert webhook responded ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Raises an alert. Never throws — alerting must not break the request or job
 * that triggered it.
 */
export async function sendOperationalAlert(
  alert: OperationalAlert
): Promise<AlertOutcome> {
  const details = redactAlertDetails(alert.details);
  const logFields = {
    event: "operational_alert",
    alert_event: alert.event,
    category: alert.category,
    severity: alert.severity,
    title: alert.title,
    environment: environmentName(),
    ...details,
  };

  let decision: Awaited<ReturnType<typeof gate>>;
  try {
    decision = await gate(getSecurityKvStore(), alert);
  } catch (err) {
    logger.warn("operational_alert_store_unavailable", {
      error: err instanceof Error ? err.message : String(err),
    });
    decision = await gate(fallbackStore, alert);
  }

  if (decision !== "deliver") {
    logger.info("operational_alert", { ...logFields, delivery: decision });
    return decision;
  }

  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!url) {
    logger.error("operational_alert", {
      ...logFields,
      delivery: "log_only",
      note: "OPS_ALERT_WEBHOOK_URL not configured",
    });
    return "logged";
  }

  try {
    await deliver(url, formatText(alert, details));
    logger.warn("operational_alert", { ...logFields, delivery: "sent" });
    return "sent";
  } catch (err) {
    logger.error("operational_alert", {
      ...logFields,
      delivery: "failed",
      deliveryError: err instanceof Error ? err.message : String(err),
    });
    return "logged";
  }
}
