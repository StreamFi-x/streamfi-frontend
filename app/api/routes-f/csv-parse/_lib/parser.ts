import type { CsvParseResult } from "../types";

function coerce(value: string): string | number {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return value;
}

export function parseCsvText(csv: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function buildCsvResult(csv: string, hasHeader: boolean, delimiter: string): CsvParseResult {
  const parsedRows = parseCsvText(csv, delimiter);
  if (parsedRows.length === 0) {
    return { headers: hasHeader ? [] : undefined, rows: [], row_count: 0 };
  }

  const expectedColumns = parsedRows[0].length;
  const badRows: number[] = [];
  parsedRows.forEach((row, idx) => {
    if (row.length !== expectedColumns) {
      badRows.push(idx + 1);
    }
  });

  if (badRows.length > 0) {
    throw new Error(`Ragged rows at indexes: ${badRows.join(", ")}`);
  }

  let headers: string[] | undefined;
  let dataRows = parsedRows;
  if (hasHeader) {
    headers = parsedRows[0];
    dataRows = parsedRows.slice(1);
  }

  const rows = dataRows.map((r) => r.map(coerce));
  return { headers, rows, row_count: rows.length };
}
