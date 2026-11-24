/**
 * @jest-environment node
 *
 * Staleness check: docs/api/openapi.json must describe exactly the routes
 * (and HTTP methods) implemented under app/api for the tips, streams and
 * users groups. Add, remove or re-method a route and this test fails until the
 * spec is updated.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const API_DIR = path.join(ROOT, "app", "api");
const GROUPS = ["tips", "streams", "users"];
const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function findRouteFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : findRouteFiles(full);
    }
    return entry.name === "route.ts" ? [full] : [];
  });
}

function implementedOperations(): Set<string> {
  const ops = new Set<string>();
  for (const group of GROUPS) {
    for (const file of findRouteFiles(path.join(API_DIR, group))) {
      const source = fs.readFileSync(file, "utf8");
      const route =
        "/" +
        path
          .relative(ROOT, path.dirname(file))
          .split(path.sep)
          .join("/")
          .replace(/^app\//, "")
          .replace(/\[([^\]]+)\]/g, "{$1}")
          .replace(/^\/app/, "");
      for (const verb of VERBS) {
        const declared = new RegExp(
          `export\\s+(async\\s+function|const)\\s+${verb}\\b`
        ).test(source);
        const reexported = new RegExp(
          `export\\s*\\{[^}]*\\bas\\s+${verb}\\b`
        ).test(source);
        if (declared || reexported) {
          ops.add(`${verb} ${route}`);
        }
      }
    }
  }
  return ops;
}

const spec = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs", "api", "openapi.json"), "utf8")
) as {
  openapi: string;
  paths: Record<
    string,
    Record<string, { operationId?: string; responses?: object }>
  >;
  components: {
    schemas: Record<string, unknown>;
    parameters: Record<string, unknown>;
  };
};

function documentedOperations(): Set<string> {
  const ops = new Set<string>();
  for (const [route, item] of Object.entries(spec.paths)) {
    for (const method of Object.keys(item)) {
      ops.add(`${method.toUpperCase()} ${route}`);
    }
  }
  return ops;
}

describe("OpenAPI spec", () => {
  it("is an OpenAPI 3.1 document", () => {
    expect(spec.openapi).toMatch(/^3\.1\./);
  });

  it("documents every implemented operation (no missing entries)", () => {
    const documented = documentedOperations();
    const missing = [...implementedOperations()].filter(
      op => !documented.has(op)
    );
    expect(missing).toEqual([]);
  });

  it("documents no operation that no longer exists (no stale entries)", () => {
    const implemented = implementedOperations();
    const stale = [...documentedOperations()].filter(
      op => !implemented.has(op)
    );
    expect(stale).toEqual([]);
  });

  it("covers the tips, streams and users groups", () => {
    const routes = Object.keys(spec.paths);
    for (const group of GROUPS) {
      expect(routes.some(r => r.startsWith(`/api/${group}/`))).toBe(true);
    }
  });

  it("gives every operation a unique operationId and a response", () => {
    const ids = new Set<string>();
    for (const item of Object.values(spec.paths)) {
      for (const operation of Object.values(item)) {
        expect(operation.operationId).toBeTruthy();
        expect(ids.has(operation.operationId as string)).toBe(false);
        ids.add(operation.operationId as string);
        expect(Object.keys(operation.responses ?? {}).length).toBeGreaterThan(
          0
        );
      }
    }
  });

  it("resolves every $ref against components", () => {
    const text = JSON.stringify(spec);
    const refs = [...text.matchAll(/"\$ref":"#\/components\/(\w+)\/(\w+)"/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const [, kind, name] of refs) {
      const bucket = (
        spec.components as Record<string, Record<string, unknown>>
      )[kind];
      expect(bucket?.[name]).toBeDefined();
    }
  });

  it("documents the correlation header on the tipping flow", () => {
    for (const route of [
      "/api/tips/get-quote",
      "/api/tips/send",
      "/api/tips/refresh-total",
    ]) {
      const params = JSON.stringify(spec.paths[route].post);
      expect(params).toContain("#/components/parameters/CorrelationId");
    }
  });

  it("documents the shared pagination envelope on migrated list endpoints", () => {
    for (const route of ["/api/streams/live", "/api/users/top"]) {
      const get = JSON.stringify(spec.paths[route].get);
      expect(get).toContain("nextCursor");
      expect(get).toContain("#/components/parameters/Cursor");
    }
  });
});
