/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/unix-date", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/unix-date", () => {
  it("converts unix seconds to ISO", async () => {
    const res = await POST(makeReq({ mode: "to_iso", value: 0, unit: "s" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      result: "1970-01-01T00:00:00.000Z",
      unit: "s",
    });
  });

  it("converts unix milliseconds to ISO", async () => {
    const res = await POST(makeReq({ mode: "to_iso", value: 1716243825123, unit: "ms" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      result: "2024-05-20T22:23:45.123Z",
      unit: "ms",
    });
  });

  it("converts negative unix seconds before 1970", async () => {
    const res = await POST(makeReq({ mode: "to_iso", value: -1, unit: "s" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      result: "1969-12-31T23:59:59.000Z",
      unit: "s",
    });
  });

  it("converts ISO dates to unix seconds", async () => {
    const res = await POST(
      makeReq({ mode: "to_unix", value: "2024-05-20T22:23:45.000Z", unit: "s" })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      result: 1716243825,
      unit: "s",
    });
  });

  it("converts ISO dates to unix milliseconds", async () => {
    const res = await POST(
      makeReq({ mode: "to_unix", value: "2024-05-20T22:23:45.123Z", unit: "ms" })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      result: 1716243825123,
      unit: "ms",
    });
  });

  it("round-trips seconds", async () => {
    const toIso = await POST(makeReq({ mode: "to_iso", value: -123456789, unit: "s" }));
    const isoBody = await toIso.json();
    const toUnix = await POST(makeReq({ mode: "to_unix", value: isoBody.result, unit: "s" }));

    expect(toUnix.status).toBe(200);
    await expect(toUnix.json()).resolves.toEqual({
      result: -123456789,
      unit: "s",
    });
  });

  it("round-trips milliseconds", async () => {
    const toIso = await POST(makeReq({ mode: "to_iso", value: -123456789123, unit: "ms" }));
    const isoBody = await toIso.json();
    const toUnix = await POST(makeReq({ mode: "to_unix", value: isoBody.result, unit: "ms" }));

    expect(toUnix.status).toBe(200);
    await expect(toUnix.json()).resolves.toEqual({
      result: -123456789123,
      unit: "ms",
    });
  });

  it("rejects invalid modes", async () => {
    const res = await POST(makeReq({ mode: "convert", value: 0, unit: "s" }));

    expect(res.status).toBe(400);
  });
});
