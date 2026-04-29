/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as getStatus } from "../route";
import { GET as getHistory } from "../history/route";
import { POST as createIncident } from "../incidents/route";
import { PATCH as updateIncident } from "../incidents/[id]/route";

function makeReq(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/routes-f/status", () => {
  it("returns overall and per-service platform status", async () => {
    const res = await getStatus();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall).toBeDefined();
    expect(body.services.live_streaming).toBeDefined();
    expect(Array.isArray(body.active_incidents)).toBe(true);
  });

  it("creates incidents and overlays affected services", async () => {
    const created = await createIncident(
      makeReq("http://localhost/api/routes-f/status/incidents", {
        title: "Chat delivery delays",
        severity: "minor",
        affects: ["chat"],
        update: "We are investigating delayed messages.",
      })
    );
    const incident = await created.json();
    const status = await getStatus();
    const body = await status.json();

    expect(created.status).toBe(201);
    expect(incident.updates[0].body).toContain("investigating");
    expect(body.services.chat).toBe("degraded");
  });

  it("updates and resolves incidents", async () => {
    const created = await createIncident(
      makeReq("http://localhost/api/routes-f/status/incidents", {
        title: "Payments outage",
        severity: "critical",
        affects: ["payments"],
      })
    );
    const incident = await created.json();

    const patched = await updateIncident(
      makeReq("http://localhost/api/routes-f/status/incidents/id", {
        status: "resolved",
        update: "Payments are healthy again.",
      }),
      { params: Promise.resolve({ id: incident.id }) }
    );
    const body = await patched.json();

    expect(patched.status).toBe(200);
    expect(body.status).toBe("resolved");
    expect(body.resolved_at).toBeTruthy();
  });

  it("returns incident history and uptime", async () => {
    const res = await getHistory();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.window_days).toBe(90);
    expect(body.uptime.payments).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.incidents)).toBe(true);
  });
});
