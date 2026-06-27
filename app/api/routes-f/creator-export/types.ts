export const EXPORT_SECTIONS = [
  "streams",
  "tips",
  "followers",
  "subscribers",
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export type ExportStatus = "queued" | "ready" | "failed";

export interface ExportJob {
  export_id: string;
  creator_id: string;
  sections: ExportSection[];
  status: ExportStatus;
  created_at: string;
  ready_at?: string;
  download_url?: string;
  error?: string;
}

export interface CreateExportBody {
  creator_id: string;
  sections: ExportSection[];
}

export interface CreateExportResponse {
  export_id: string;
  status: "queued";
}

export interface ExportStatusResponse {
  status: ExportStatus;
  download_url?: string;
  error?: string;
}
