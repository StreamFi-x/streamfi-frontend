/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import {
  CORRELATION_HEADER,
  createCorrelationId,
  isValidCorrelationId,
  readCorrelationId,
  withCorrelationHeader,
} from "@/lib/tracing/correlation";
import {
  TIP_FLOW_GRACE_MS,
  beginTipFlow,
  completeTipFlow,
  endTipFlow,
  getTipFlowId,
  getTipFlowIdOrNew,
  tipFlowHeaders,
} from "@/lib/tracing/tip-flow";
import { withTracing } from "@/lib/tracing/api-route-wrapper";
import { logger } from "@/lib/tracing/logger";

describe("correlation ids", () => {
  it("generates distinct valid ids", () => {
    const a = createCorrelationId();
    expect(isValidCorrelationId(a)).toBe(true);
    expect(createCorrelationId()).not.toBe(a);
  });

  it.each([
    ["too short", "abc"],
    ["too long", "a".repeat(65)],
    ["spaces", "corr id with spaces"],
    ["newline injection", "corr-12345678\nlevel=error"],
    ["json", '{"a":1}12345'],
  ])("rejects %s", (_label, value) => {
    expect(isValidCorrelationId(value)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidCorrelationId(undefined)).toBe(false);
    expect(isValidCorrelationId(42)).toBe(false);
  });

  it("reads a valid header and ignores a malformed one", () => {
    const good = new Headers({ [CORRELATION_HEADER]: "corr-abcdef123456" });
    expect(readCorrelationId(good)).toBe("corr-abcdef123456");
    expect(
      readCorrelationId(new Headers({ [CORRELATION_HEADER]: "bad id" }))
    ).toBeUndefined();
    expect(readCorrelationId(new Headers())).toBeUndefined();
  });

  it("merges the header into existing headers", () => {
    const headers = withCorrelationHeader("corr-abcdef123456", {
      "Content-Type": "application/json",
    });
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get(CORRELATION_HEADER)).toBe("corr-abcdef123456");
  });
});

describe("tip flow", () => {
  beforeEach(() => endTipFlow());

  it("returns the same id for every call in one flow", () => {
    const id = beginTipFlow();
    expect(getTipFlowId()).toBe(id);
    expect(tipFlowHeaders({ A: "b" })).toEqual({
      A: "b",
      [CORRELATION_HEADER]: id,
    });
    expect(tipFlowHeaders()[CORRELATION_HEADER]).toBe(id);
  });

  it("starts a new id for each new flow", () => {
    const first = beginTipFlow();
    expect(beginTipFlow()).not.toBe(first);
  });

  it("keeps the id after completion for the grace period only", () => {
    const id = beginTipFlow();
    const t0 = 1_000_000;
    completeTipFlow(t0);
    expect(getTipFlowId(t0 + TIP_FLOW_GRACE_MS)).toBe(id);
    expect(getTipFlowId(t0 + TIP_FLOW_GRACE_MS + 1)).toBeNull();
  });

  it("gives standalone actions a fresh id when no flow exists", () => {
    expect(getTipFlowId()).toBeNull();
    const a = getTipFlowIdOrNew();
    expect(isValidCorrelationId(a)).toBe(true);
    expect(getTipFlowIdOrNew()).not.toBe(a);
  });

  it("completeTipFlow without an active flow is a no-op", () => {
    expect(() => completeTipFlow()).not.toThrow();
    expect(getTipFlowId()).toBeNull();
  });
});

describe("server side propagation", () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    jest
      .spyOn(console, "log")
      .mockImplementation(m => void logs.push(String(m)));
    jest
      .spyOn(console, "warn")
      .mockImplementation(m => void logs.push(String(m)));
    jest
      .spyOn(console, "error")
      .mockImplementation(m => void logs.push(String(m)));
  });
  afterEach(() => jest.restoreAllMocks());

  const parsed = () => logs.map(l => JSON.parse(l) as Record<string, unknown>);

  function request(correlationId?: string) {
    return new NextRequest("http://localhost/api/tips/get-quote", {
      method: "POST",
      headers: correlationId ? { [CORRELATION_HEADER]: correlationId } : {},
    });
  }

  it("puts the correlation id in every log line of the request", async () => {
    const handler = withTracing(async () => {
      logger.info("inside handler");
      logger.warn("also inside");
      return NextResponse.json({ ok: true });
    });
    const res = await handler(request("corr-abcdef123456"));

    expect(res.headers.get(CORRELATION_HEADER)).toBe("corr-abcdef123456");
    const entries = parsed();
    expect(entries.length).toBeGreaterThanOrEqual(4);
    for (const entry of entries) {
      expect(entry.correlationId).toBe("corr-abcdef123456");
    }
  });

  it("uses one correlation id but distinct trace ids across the flow's requests", async () => {
    const handler = withTracing(async () => NextResponse.json({}));
    const a = await handler(request("corr-abcdef123456"));
    const b = await handler(request("corr-abcdef123456"));

    expect(a.headers.get(CORRELATION_HEADER)).toBe(
      b.headers.get(CORRELATION_HEADER)
    );
    expect(a.headers.get("x-request-id")).not.toBe(
      b.headers.get("x-request-id")
    );
  });

  it("drops a malformed id instead of logging attacker-controlled text", async () => {
    const handler = withTracing(async () => NextResponse.json({}));
    const res = await handler(request("bad id with spaces"));

    expect(res.headers.get(CORRELATION_HEADER)).toBeNull();
    for (const entry of parsed()) {
      expect(entry).not.toHaveProperty("correlationId");
    }
  });

  it("omits the field when the client sent none", async () => {
    const handler = withTracing(async () => NextResponse.json({}));
    const res = await handler(request());

    expect(res.headers.get(CORRELATION_HEADER)).toBeNull();
    expect(parsed()[0]).not.toHaveProperty("correlationId");
  });

  it("keeps the correlation id on the 500 path", async () => {
    const handler = withTracing(async () => {
      throw new Error("boom");
    });
    const res = await handler(request("corr-abcdef123456"));

    expect(res.status).toBe(500);
    expect(res.headers.get(CORRELATION_HEADER)).toBe("corr-abcdef123456");
    expect((await res.json()).correlationId).toBe("corr-abcdef123456");
    expect(parsed().every(e => e.correlationId === "corr-abcdef123456")).toBe(
      true
    );
  });
});
