import { sql } from "@vercel/postgres";
import { buildHealthReport } from "../../health/_lib/service";

export type IncidentSeverity = "minor" | "major" | "critical";
export type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";
export type ServiceKey =
  | "live_streaming"
  | "payments"
  | "chat"
  | "recordings"
  | "website";
export type ServiceStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage";
export type OverallStatus = ServiceStatus;

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  body: string;
  status: IncidentStatus;
  created_at: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affects: string[];
  created_at: string;
  resolved_at: string | null;
  updates: IncidentUpdate[];
}

const SERVICES: ServiceKey[] = [
  "live_streaming",
  "payments",
  "chat",
  "recordings",
  "website",
];

const VALID_SEVERITIES: IncidentSeverity[] = ["minor", "major", "critical"];
const VALID_STATUSES: IncidentStatus[] = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
];

const memoryStore = globalThis as typeof globalThis & {
  __routesFStatusIncidents?: Incident[];
};

function shouldUseDatabase() {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function normalizeAffects(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const affects = value.map(item => String(item).trim()).filter(Boolean);
  if (
    affects.length === 0 ||
    affects.some(
      item => item !== "all" && !SERVICES.includes(item as ServiceKey)
    )
  ) {
    return null;
  }

  return affects;
}

function getMemoryIncidents() {
  if (!memoryStore.__routesFStatusIncidents) {
    memoryStore.__routesFStatusIncidents = [];
  }
  return memoryStore.__routesFStatusIncidents;
}

async function ensureTables() {
  await sql`DO $$ BEGIN
    CREATE TYPE incident_severity AS ENUM ('minor', 'major', 'critical');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`;

  await sql`DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('investigating', 'identified', 'monitoring', 'resolved');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`;

  await sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      severity incident_severity NOT NULL,
      status incident_status DEFAULT 'investigating',
      affects TEXT[],
      created_at TIMESTAMPTZ DEFAULT now(),
      resolved_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS incident_updates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      status incident_status NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

function withUpdates(rows: any[], updateRows: any[]): Incident[] {
  return rows.map(row => ({
    id: String(row.id),
    title: String(row.title),
    severity: row.severity as IncidentSeverity,
    status: row.status as IncidentStatus,
    affects: Array.isArray(row.affects) ? row.affects : [],
    created_at: new Date(row.created_at).toISOString(),
    resolved_at: row.resolved_at
      ? new Date(row.resolved_at).toISOString()
      : null,
    updates: updateRows
      .filter(update => String(update.incident_id) === String(row.id))
      .map(update => ({
        id: String(update.id),
        incident_id: String(update.incident_id),
        body: String(update.body),
        status: update.status as IncidentStatus,
        created_at: new Date(update.created_at).toISOString(),
      })),
  }));
}

export function validateIncidentInput(body: any) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const severity = body?.severity as IncidentSeverity;
  const status = (body?.status ?? "investigating") as IncidentStatus;
  const affects = normalizeAffects(body?.affects);
  const updateBody = typeof body?.update === "string" ? body.update.trim() : "";

  if (!title) {
    return { error: "title is required" };
  }
  if (!VALID_SEVERITIES.includes(severity)) {
    return { error: "severity must be minor, major, or critical" };
  }
  if (!VALID_STATUSES.includes(status)) {
    return {
      error:
        "status must be investigating, identified, monitoring, or resolved",
    };
  }
  if (!affects) {
    return { error: "affects must include all or at least one known service" };
  }

  return { title, severity, status, affects, updateBody };
}

export function validateIncidentUpdateInput(body: any) {
  const status = body?.status as IncidentStatus | undefined;
  const updateBody = typeof body?.update === "string" ? body.update.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : undefined;
  const severity = body?.severity as IncidentSeverity | undefined;
  const affects =
    body?.affects === undefined ? undefined : normalizeAffects(body.affects);

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return {
      error:
        "status must be investigating, identified, monitoring, or resolved",
    };
  }
  if (severity !== undefined && !VALID_SEVERITIES.includes(severity)) {
    return { error: "severity must be minor, major, or critical" };
  }
  if (body?.affects !== undefined && !affects) {
    return { error: "affects must include all or at least one known service" };
  }
  if (!status && !updateBody && !title && !severity && !affects) {
    return { error: "provide status, update, title, severity, or affects" };
  }

  return { status, updateBody, title, severity, affects };
}

export async function createIncident(
  input: ReturnType<typeof validateIncidentInput>
) {
  if ("error" in input) {
    throw new Error(input.error);
  }

  const createdAt = nowIso();
  const resolvedAt = input.status === "resolved" ? createdAt : null;

  if (!shouldUseDatabase()) {
    const incident: Incident = {
      id: createId(),
      title: input.title,
      severity: input.severity,
      status: input.status,
      affects: input.affects,
      created_at: createdAt,
      resolved_at: resolvedAt,
      updates: input.updateBody
        ? [
            {
              id: createId(),
              incident_id: "",
              body: input.updateBody,
              status: input.status,
              created_at: createdAt,
            },
          ]
        : [],
    };
    incident.updates = incident.updates.map(update => ({
      ...update,
      incident_id: incident.id,
    }));
    getMemoryIncidents().unshift(incident);
    return incident;
  }

  await ensureTables();
  const affectsCsv = input.affects.join(",");
  const { rows } = await sql`
    INSERT INTO incidents (title, severity, status, affects, resolved_at)
    VALUES (${input.title}, ${input.severity}, ${input.status}, string_to_array(${affectsCsv}, ','), ${resolvedAt})
    RETURNING *
  `;
  const incident = withUpdates(rows, [])[0];

  if (input.updateBody) {
    const { rows: updateRows } = await sql`
      INSERT INTO incident_updates (incident_id, body, status)
      VALUES (${incident.id}, ${input.updateBody}, ${input.status})
      RETURNING *
    `;
    incident.updates = withUpdates([rows[0]], updateRows)[0].updates;
  }

  return incident;
}

export async function updateIncident(
  id: string,
  input: ReturnType<typeof validateIncidentUpdateInput>
) {
  if ("error" in input) {
    throw new Error(input.error);
  }

  if (!shouldUseDatabase()) {
    const incident = getMemoryIncidents().find(item => item.id === id);
    if (!incident) {
      return null;
    }

    if (input.title) {
      incident.title = input.title;
    }
    if (input.severity) {
      incident.severity = input.severity;
    }
    if (input.affects) {
      incident.affects = input.affects;
    }
    if (input.status) {
      incident.status = input.status;
      incident.resolved_at = input.status === "resolved" ? nowIso() : null;
    }
    if (input.updateBody) {
      incident.updates.unshift({
        id: createId(),
        incident_id: incident.id,
        body: input.updateBody,
        status: incident.status,
        created_at: nowIso(),
      });
    }
    return incident;
  }

  await ensureTables();
  const current = await sql`SELECT * FROM incidents WHERE id = ${id} LIMIT 1`;
  if (current.rows.length === 0) {
    return null;
  }

  const nextStatus = input.status ?? current.rows[0].status;
  const resolvedAt =
    input.status === "resolved"
      ? new Date().toISOString()
      : input.status
        ? null
        : current.rows[0].resolved_at;
  const affectsCsv = input.affects?.join(",") ?? null;

  const { rows } = await sql`
    UPDATE incidents
    SET
      title = COALESCE(${input.title ?? null}, title),
      severity = COALESCE(${input.severity ?? null}, severity),
      status = ${nextStatus},
      affects = COALESCE(string_to_array(${affectsCsv}, ','), affects),
      resolved_at = ${resolvedAt}
    WHERE id = ${id}
    RETURNING *
  `;

  let updateRows: any[] = [];
  if (input.updateBody) {
    const inserted = await sql`
      INSERT INTO incident_updates (incident_id, body, status)
      VALUES (${id}, ${input.updateBody}, ${nextStatus})
      RETURNING *
    `;
    updateRows = inserted.rows;
  }

  return withUpdates(rows, updateRows)[0];
}

export async function listIncidents(includeRecentlyResolved = false) {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const recentlyResolvedCutoff = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  if (!shouldUseDatabase()) {
    return getMemoryIncidents()
      .filter(incident => incident.created_at >= cutoff)
      .filter(
        incident =>
          includeRecentlyResolved ||
          incident.status !== "resolved" ||
          (incident.resolved_at !== null &&
            incident.resolved_at >= recentlyResolvedCutoff)
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  await ensureTables();
  const { rows } = includeRecentlyResolved
    ? await sql`
        SELECT * FROM incidents
        WHERE created_at >= ${cutoff}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT * FROM incidents
        WHERE created_at >= ${cutoff}
          AND (status <> 'resolved' OR resolved_at >= ${recentlyResolvedCutoff})
        ORDER BY created_at DESC
      `;

  const ids = rows.map(row => String(row.id));
  const { rows: updateRows } =
    ids.length === 0
      ? { rows: [] }
      : await sql`
          SELECT * FROM incident_updates
          WHERE incident_id = ANY(string_to_array(${ids.join(",")}, ',')::uuid[])
          ORDER BY created_at DESC
        `;

  return withUpdates(rows, updateRows);
}

function serviceStatusFromIncident(incident: Incident): ServiceStatus {
  if (incident.status === "resolved") {
    return "operational";
  }
  if (incident.severity === "critical") {
    return "major_outage";
  }
  if (incident.severity === "major") {
    return "partial_outage";
  }
  return "degraded";
}

function worstStatus(statuses: ServiceStatus[]): ServiceStatus {
  const order: ServiceStatus[] = [
    "operational",
    "degraded",
    "partial_outage",
    "major_outage",
  ];
  return statuses.reduce((worst, status) =>
    order.indexOf(status) > order.indexOf(worst) ? status : worst
  );
}

export async function buildStatusResponse() {
  const [health, incidents] = await Promise.all([
    buildHealthReport(),
    listIncidents(false),
  ]);

  const services = Object.fromEntries(
    SERVICES.map(service => [service, "operational" as ServiceStatus])
  ) as Record<ServiceKey, ServiceStatus>;

  if (health.status !== "ok") {
    services.website = "degraded";
  }

  for (const incident of incidents) {
    if (incident.status === "resolved") {
      continue;
    }
    const affectedServices = incident.affects.includes("all")
      ? SERVICES
      : (incident.affects as ServiceKey[]);
    for (const service of affectedServices) {
      services[service] = worstStatus([
        services[service],
        serviceStatusFromIncident(incident),
      ]);
    }
  }

  const overall = worstStatus(Object.values(services));

  return {
    overall,
    services,
    active_incidents: incidents,
    last_updated: nowIso(),
  };
}

export async function buildHistoryResponse() {
  const incidents = await listIncidents(true);
  const windowStart = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const windowEnd = Date.now();
  const totalWindowMs = windowEnd - windowStart;

  const uptime = Object.fromEntries(
    SERVICES.map(service => {
      const downtimeMs = incidents.reduce((total, incident) => {
        if (
          incident.status !== "resolved" ||
          (!incident.affects.includes("all") &&
            !incident.affects.includes(service))
        ) {
          return total;
        }

        const start = Math.max(
          new Date(incident.created_at).getTime(),
          windowStart
        );
        const end = Math.min(
          incident.resolved_at
            ? new Date(incident.resolved_at).getTime()
            : windowEnd,
          windowEnd
        );
        return total + Math.max(0, end - start);
      }, 0);

      const percentage = ((totalWindowMs - downtimeMs) / totalWindowMs) * 100;
      return [service, Number(percentage.toFixed(3))];
    })
  ) as Record<ServiceKey, number>;

  return {
    window_days: 90,
    incidents,
    uptime,
  };
}
