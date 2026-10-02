/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/swift-bic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/swift-bic", () => {
  it("returns valid: true with all fields for a valid 8-char BIC", async () => {
    // DEUTDEFF — Deutsche Bank, Germany, Frankfurt, no branch
    const req = makeReq({ bic: "DEUTDEFF" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.bank_code).toBe("DEUT");
    expect(data.country).toBe("DE");
    expect(data.location_code).toBe("FF");
    expect(data.branch).toBeNull();
  });

  it("returns valid: true with branch for a valid 11-char BIC", async () => {
    // DEUTDEFF500 — Deutsche Bank, Germany, Frankfurt, branch 500
    const req = makeReq({ bic: "DEUTDEFF500" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.bank_code).toBe("DEUT");
    expect(data.country).toBe("DE");
    expect(data.location_code).toBe("FF");
    expect(data.branch).toBe("500");
  });

  it("returns valid: false for wrong-length BIC", async () => {
    // 7 chars — too short
    const req = makeReq({ bic: "DEUTDEF" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it("returns valid: false with error for unknown country code", async () => {
    // BANKZZFF — country code ZZ does not exist
    const req = makeReq({ bic: "BANKZZFF" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.error).toBe("unknown country code");
  });

  it("returns valid: false for lowercase BIC (must be uppercase)", async () => {
    const req = makeReq({ bic: "deutdeff" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.valid).toBe(false);
  });
});
