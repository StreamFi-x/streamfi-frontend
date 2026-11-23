#!/usr/bin/env node
// Compares npm audit's high/critical advisories against a committed baseline.
// The repository already carries legacy advisories; a PR should be blocked
// only when it introduces a NEW one. See docs/security-ci-audit.md.

import { readFileSync, writeFileSync } from "node:fs";

const [, , reportPath = "audit-report.json", flag] = process.argv;
const baselinePath = new URL(
  "../security/audit-baseline.json",
  import.meta.url
);

function advisoriesFrom(report) {
  const ids = new Set();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via === "string") {
        continue;
      }
      if (via.severity !== "high" && via.severity !== "critical") {
        continue;
      }
      ids.add(via.source ?? via.url ?? via.title);
    }
  }
  return [...ids].sort();
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const current = advisoriesFrom(report);

if (flag === "--update-baseline") {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Wrote ${current.length} baseline advisories.`);
  process.exit(0);
}

if (report.error) {
  console.error(
    `npm audit failed: ${report.error.code ?? report.error.message}`
  );
  process.exit(2);
}

const baseline = new Set(JSON.parse(readFileSync(baselinePath, "utf8")));
const introduced = current.filter(id => !baseline.has(id));
const resolved = [...baseline].filter(id => !current.includes(id));

if (resolved.length > 0) {
  console.log(
    `Resolved advisories (refresh the baseline): ${resolved.join(", ")}`
  );
}
if (introduced.length > 0) {
  console.error(`New high/critical advisories introduced:`);
  for (const id of introduced) {
    console.error(`  - ${id}`);
  }
  process.exit(1);
}

console.log(
  `No new high/critical advisories (${current.length} known advisories tracked).`
);
