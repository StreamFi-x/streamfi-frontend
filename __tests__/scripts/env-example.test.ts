/**
 * @jest-environment node
 *
 * Tests for .env.example accuracy and enforcement (#1712)
 */

import { auditEnvExample } from "../../scripts/check-env-example.mjs";

describe("Environment Variables Template (.env.example) (#1712)", () => {
  it("documents every environment variable referenced in the application codebase", () => {
    const result = auditEnvExample();

    expect(result.missingFromExample).toEqual([]);
    expect(result.documentedCount).toBeGreaterThanOrEqual(result.usedCount);
  });
});
