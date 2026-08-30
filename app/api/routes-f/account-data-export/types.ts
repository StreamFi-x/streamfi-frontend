export type ExportStatus = "queued" | "ready" | "failed";

export interface ExportJob {
  export_id: string;
  account_id: string;
  status: ExportStatus;
  created_at: string;
  ready_at?: string;
  download_url?: string;
  emailed_at?: string;
  error?: string;
}

export interface CreateExportBody {
  account_id: string;
}

export interface CreateExportResponse {
  export_id: string;
  status: "queued";
}

export interface ExportStatusResponse {
  status: ExportStatus;
  download_url?: string;
  emailed_at?: string;
  error?: string;
}
