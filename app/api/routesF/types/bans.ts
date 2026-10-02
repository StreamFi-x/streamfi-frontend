export interface BanRecord {
  id: string;
  creator_id: string;
  viewer_id: string;
  reason: string;
  banned_at: string;
}

export interface CSVImportRequest {
  creator_id: string;
  csv: string;
}

export interface CSVImportResult {
  imported: number;
  skipped: number;
  reasons: string[];
}

export interface ParsedCSVRow {
  viewer_id: string;
  reason: string;
}

export interface BanExportRequest {
  creator_id: string;
}