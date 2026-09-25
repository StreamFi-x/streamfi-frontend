/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { resetReportStore } from "../seedData";

function makePatch(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/moderation-report-resolve",
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("PATCH /api/routes-f/moderation-report-resolve", () => {
  beforeEach(() => {
    resetReportStore();
  });

  it("resolves an open report with a dismissed outcome", async () => {
    const res = await PATCH(
      makePatch({ reportId: "report_open_1", outcome: "dismissed" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.reportId).toBe("report_open_1");
    expect(body.status).toBe("resolved");
    expect(body.outcome).toBe("dismissed");
    expect(typeof body.resolved_at).toBe("string");
    expect(Number.isNaN(Date.parse(body.resolved_at))).toBe(false);
  });

  it.each(["dismissed", "warned", "timeout", "banned"] as const)(
    "accepts the '%s' outcome",
    async (outcome) => {
      const res = await PATCH(makePatch({ reportId: "report_open_1", outcome }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.outcome).toBe(outcome);
    }
  );

  it("returns 404 for an unknown reportId", async () => {
    const res = await PATCH(
      makePatch({ reportId: "does_not_exist", outcome: "warned" })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 409 when the report has already been resolved", async () => {
    const res = await PATCH(
      makePatch({ reportId: "report_resolved_1", outcome: "banned" })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already been resolved/i);
  });

  it("does not allow resolving the same report twice", async () => {
    const first = await PATCH(
      makePatch({ reportId: "report_open_2", outcome: "timeout" })
    );
    expect(first.status).toBe(200);

    const second = await PATCH(
      makePatch({ reportId: "report_open_2", outcome: "banned" })
    );
    expect(second.status).toBe(409);
  });

  it("returns 400 when reportId is missing", async () => {
    const res = await PATCH(makePatch({ outcome: "warned" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("reportId");
  });

  it("returns 400 when reportId is not a string", async () => {
    const res = await PATCH(makePatch({ reportId: 123, outcome: "warned" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when outcome is missing", async () => {
    const res = await PATCH(makePatch({ reportId: "report_open_1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("outcome");
  });

  it("returns 400 for an invalid outcome value", async () => {
    const res = await PATCH(
      makePatch({ reportId: "report_open_1", outcome: "ignored" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/moderation-report-resolve",
      {
        method: "PATCH",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
