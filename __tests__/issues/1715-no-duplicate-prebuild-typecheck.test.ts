import fs from "fs";
import path from "path";

/**
 * #1715 — Vercel runs `npm run build`, and npm auto-runs a `prebuild` script
 * (if one exists) immediately before it. A `prebuild` that re-ran `tsc` used
 * to duplicate the type check CI's own `type-check` step already performs,
 * adding a full type-check pass to every single preview deploy for no
 * benefit over catching the same errors once in CI.
 *
 * The duplication was already removed (PR #1921) before this was filed as
 * an explicit regression concern — this pins it so a `prebuild` can't
 * silently reintroduce the duplicate type check without this test failing.
 */
describe("build pipeline does not duplicate type checking (#1715)", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
  ) as { scripts: Record<string, string> };

  it("has no prebuild script", () => {
    expect(packageJson.scripts.prebuild).toBeUndefined();
  });

  it("does not invoke tsc/type-check from the build script itself", () => {
    expect(packageJson.scripts.build).not.toMatch(/tsc|type-check/);
  });

  it("keeps a single dedicated type-check script for CI to call", () => {
    expect(packageJson.scripts["type-check"]).toMatch(/tsc/);
  });
});
