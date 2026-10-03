/**
 * Splits a SQL script into individual statements.
 *
 * Only needed for `-- migrate:no-transaction` migrations: PostgreSQL runs a
 * multi-statement simple query inside one implicit transaction block, which
 * rejects statements such as CREATE INDEX CONCURRENTLY. Those migrations are
 * therefore executed one statement at a time.
 *
 * Handles line comments, block comments (nested), single-quoted strings
 * (including E'' escapes), double-quoted identifiers and dollar-quoted bodies.
 */
export function splitSqlStatements(script: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  const n = script.length;

  const push = () => {
    const trimmed = current.trim();
    if (trimmed && !isOnlyComments(trimmed)) {
      statements.push(trimmed);
    }
    current = "";
  };

  while (i < n) {
    const ch = script[i];
    const next = script[i + 1];

    if (ch === "-" && next === "-") {
      const end = script.indexOf("\n", i);
      const stop = end === -1 ? n : end + 1;
      current += script.slice(i, stop);
      i = stop;
      continue;
    }

    if (ch === "/" && next === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (script[j] === "/" && script[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (script[j] === "*" && script[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      if (depth > 0) {
        throw new Error("Unterminated block comment in SQL script");
      }
      current += script.slice(i, j);
      i = j;
      continue;
    }

    if (ch === "'") {
      const escaped = i > 0 && /[eE]/.test(script[i - 1] ?? "");
      let j = i + 1;
      while (j < n) {
        if (escaped && script[j] === "\\") {
          j += 2;
          continue;
        }
        if (script[j] === "'") {
          if (script[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      if (j >= n) {
        throw new Error("Unterminated string literal in SQL script");
      }
      current += script.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (ch === '"') {
      const end = script.indexOf('"', i + 1);
      if (end === -1) {
        throw new Error("Unterminated quoted identifier in SQL script");
      }
      current += script.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    if (ch === "$") {
      const tagMatch = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(script.slice(i));
      const precededByIdentifier = /[A-Za-z0-9_]/.test(script[i - 1] ?? "");
      if (tagMatch && !precededByIdentifier) {
        const tag = tagMatch[0];
        const end = script.indexOf(tag, i + tag.length);
        if (end === -1) {
          throw new Error(`Unterminated dollar-quoted string ${tag}`);
        }
        current += script.slice(i, end + tag.length);
        i = end + tag.length;
        continue;
      }
    }

    if (ch === ";") {
      current += ch;
      push();
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  push();
  return statements;
}

function isOnlyComments(sql: string): boolean {
  const withoutBlock = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLine = withoutBlock.replace(/--[^\n]*/g, "");
  return withoutLine.replace(/;/g, "").trim() === "";
}
