import type { ParsedCSVRow } from '../types/bans';

const MAX_ROWS = 500;

export function parseCSV(csv: string): { 
  rows: ParsedCSVRow[];
  errors: string[];
} {
  const rows: ParsedCSVRow[] = [];
  const errors: string[] = [];
  
  if (!csv.trim()) {
    errors.push('CSV content is empty');
    return { rows, errors };
  }

  const lines = csv.trim().split('\n');
  
  // Check if we have a header
  if (lines.length === 0) {
    errors.push('CSV has no content');
    return { rows, errors };
  }

  // Skip header (first line)
  const dataLines = lines.slice(1);
  
  if (dataLines.length > MAX_ROWS) {
    errors.push(`Maximum rows exceeded (${dataLines.length} > ${MAX_ROWS})`);
  }

  const processedViewerIds = new Set<string>();
  let rowIndex = 0;

  for (const line of dataLines) {
    rowIndex++;

    // Skip rows beyond max limit
    if (rowIndex > MAX_ROWS) {
      continue;
    }

    const trimmedLine = line.trim();
    if (!trimmedLine) {
      errors.push(`Row ${rowIndex}: Empty row`);
      continue;
    }

    const columns = parseCSVLine(trimmedLine);
    
    if (columns.length < 2) {
      errors.push(`Row ${rowIndex}: Malformed row - expected 2 columns, got ${columns.length}`);
      continue;
    }

    const [viewer_id, reason] = columns;

    if (!viewer_id?.trim()) {
      errors.push(`Row ${rowIndex}: Missing viewer_id`);
      continue;
    }

    const cleanViewerId = viewer_id.trim();
    const cleanReason = reason?.trim() || 'No reason provided';

    if (processedViewerIds.has(cleanViewerId)) {
      errors.push(`Duplicate viewer_id: ${cleanViewerId}`);
      continue;
    }

    processedViewerIds.add(cleanViewerId);
    
    rows.push({
      viewer_id: cleanViewerId,
      reason: cleanReason,
    });
  }

  return { rows, errors };
}

function parseCSVLine(line: string): string[] {
  const columns: string[] = [];
  let currentColumn = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        currentColumn += '"';
        i++; // Skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      columns.push(currentColumn);
      currentColumn = '';
    } else {
      currentColumn += char;
    }
  }
  
  // Add the last column
  columns.push(currentColumn);
  
  return columns;
}

export function validateCSVRows(rows: ParsedCSVRow[]): { validRows: ParsedCSVRow[]; invalidCount: number } {
  const validRows: ParsedCSVRow[] = [];
  let invalidCount = 0;

  for (const row of rows) {
    if (row.viewer_id?.trim() && row.reason?.trim()) {
      validRows.push({
        viewer_id: row.viewer_id.trim(),
        reason: row.reason.trim(),
      });
    } else {
      invalidCount++;
    }
  }

  return { validRows, invalidCount };
}