import { NextRequest, NextResponse } from "next/server";

// Semver regex per semver.org spec
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

interface Parsed {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

function parse(version: string): Parsed | null {
  const m = SEMVER_RE.exec(version.trim());
  if (!m) return null;
  const result: Parsed = {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
  };
  if (m[4] !== undefined) result.prerelease = m[4];
  if (m[5] !== undefined) result.build = m[5];
  return result;
}

function comparePrerelease(a?: string, b?: string): number {
  // No prerelease > has prerelease (1.0.0 > 1.0.0-alpha)
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;

  const aParts = a.split(".");
  const bParts = b.split(".");
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    if (i >= aParts.length) return -1;
    if (i >= bParts.length) return 1;
    const ap = aParts[i];
    const bp = bParts[i];
    const aNum = /^\d+$/.test(ap);
    const bNum = /^\d+$/.test(bp);
    if (aNum && bNum) {
      const diff = parseInt(ap, 10) - parseInt(bp, 10);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (aNum) {
      return -1; // numeric < alphanumeric
    } else if (bNum) {
      return 1;
    } else {
      if (ap < bp) return -1;
      if (ap > bp) return 1;
    }
  }
  return 0;
}

function compare(a: Parsed, b: Parsed): -1 | 0 | 1 {
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] < b[key]) return -1;
    if (a[key] > b[key]) return 1;
  }
  const pre = comparePrerelease(a.prerelease, b.prerelease);
  return pre < 0 ? -1 : pre > 0 ? 1 : 0;
}

function bump(parsed: Parsed, level: string): string {
  let { major, minor, patch } = parsed;
  switch (level) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "prerelease": {
      const pre = parsed.prerelease;
      if (!pre) return `${major}.${minor}.${patch}-0`;
      // increment last numeric identifier
      const parts = pre.split(".");
      const last = parts[parts.length - 1];
      if (/^\d+$/.test(last)) {
        parts[parts.length - 1] = String(parseInt(last, 10) + 1);
      } else {
        parts.push("0");
      }
      return `${major}.${minor}.${patch}-${parts.join(".")}`;
    }
    default:
      throw new Error(`Unknown level: ${level}`);
  }
}

// Range satisfies: supports ^, ~, >=, <=, >, <, =, and plain version
function satisfies(version: Parsed, range: string): boolean {
  const trimmed = range.trim();

  // Handle space-separated AND ranges (e.g. ">=1.0.0 <2.0.0")
  if (/\s+/.test(trimmed) && !trimmed.startsWith("^") && !trimmed.startsWith("~")) {
    return trimmed.split(/\s+/).every((r) => satisfies(version, r));
  }

  // Caret range: ^1.2.3
  if (trimmed.startsWith("^")) {
    const base = parse(trimmed.slice(1));
    if (!base) return false;
    const lower = compare(version, base);
    if (lower < 0) return false;
    // Upper bound: next breaking change
    if (base.major !== 0) {
      return version.major === base.major;
    } else if (base.minor !== 0) {
      return version.major === 0 && version.minor === base.minor;
    } else {
      return version.major === 0 && version.minor === 0 && version.patch === base.patch;
    }
  }

  // Tilde range: ~1.2.3
  if (trimmed.startsWith("~")) {
    const base = parse(trimmed.slice(1));
    if (!base) return false;
    if (compare(version, base) < 0) return false;
    return version.major === base.major && version.minor === base.minor;
  }

  // Comparison operators
  const opMatch = /^(>=|<=|>|<|=)(.+)$/.exec(trimmed);
  if (opMatch) {
    const op = opMatch[1];
    const base = parse(opMatch[2].trim());
    if (!base) return false;
    const cmp = compare(version, base);
    switch (op) {
      case ">=": return cmp >= 0;
      case "<=": return cmp <= 0;
      case ">":  return cmp > 0;
      case "<":  return cmp < 0;
      case "=":  return cmp === 0;
    }
  }

  // Plain version (exact match)
  const base = parse(trimmed);
  if (!base) return false;
  return compare(version, base) === 0;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action } = body;

  if (!action || typeof action !== "string") {
    return NextResponse.json(
      { error: "action must be one of: parse, compare, bump, satisfies" },
      { status: 400 }
    );
  }

  switch (action) {
    case "parse": {
      const { version } = body;
      if (typeof version !== "string") {
        return NextResponse.json({ error: "version must be a string." }, { status: 400 });
      }
      const parsed = parse(version);
      if (!parsed) {
        return NextResponse.json({ error: `Invalid semver: "${version}"` }, { status: 400 });
      }
      return NextResponse.json(parsed);
    }

    case "compare": {
      const { a, b } = body;
      if (typeof a !== "string" || typeof b !== "string") {
        return NextResponse.json({ error: "a and b must be strings." }, { status: 400 });
      }
      const pa = parse(a);
      const pb = parse(b);
      if (!pa) return NextResponse.json({ error: `Invalid semver: "${a}"` }, { status: 400 });
      if (!pb) return NextResponse.json({ error: `Invalid semver: "${b}"` }, { status: 400 });
      return NextResponse.json({ result: compare(pa, pb) });
    }

    case "bump": {
      const { version, level } = body;
      if (typeof version !== "string") {
        return NextResponse.json({ error: "version must be a string." }, { status: 400 });
      }
      if (!["major", "minor", "patch", "prerelease"].includes(level as string)) {
        return NextResponse.json(
          { error: "level must be one of: major, minor, patch, prerelease" },
          { status: 400 }
        );
      }
      const parsed = parse(version);
      if (!parsed) {
        return NextResponse.json({ error: `Invalid semver: "${version}"` }, { status: 400 });
      }
      return NextResponse.json({ next: bump(parsed, level as string) });
    }

    case "satisfies": {
      const { version, range } = body;
      if (typeof version !== "string") {
        return NextResponse.json({ error: "version must be a string." }, { status: 400 });
      }
      if (typeof range !== "string") {
        return NextResponse.json({ error: "range must be a string." }, { status: 400 });
      }
      const parsed = parse(version);
      if (!parsed) {
        return NextResponse.json({ error: `Invalid semver: "${version}"` }, { status: 400 });
      }
      return NextResponse.json({ satisfies: satisfies(parsed, range) });
    }

    default:
      return NextResponse.json(
        { error: "action must be one of: parse, compare, bump, satisfies" },
        { status: 400 }
      );
  }
}
