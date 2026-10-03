import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("report-only CSP proxy", () => {
  it("sends a nonce-bearing policy without unsafe script allowances", () => {
    const response = proxy(new NextRequest("https://streamfi.media/browse"));
    const policy = response.headers.get("Content-Security-Policy-Report-Only") ?? "";
    const scriptPolicy = policy.split(";").find(directive => directive.trim().startsWith("script-src")) ?? "";
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    expect(scriptPolicy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("report-uri /api/security/csp-report");
  });
});