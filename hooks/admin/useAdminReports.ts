import useSWR from "swr";

export interface StreamReport {
  id: string;
  reporter_id: string;
  stream_id: string;
  streamer: string;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
}

export interface BugReport {
  id: string;
  reporter_id: string;
  category: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "pending" | "reviewed" | "resolved";
  created_at: string;
}

interface ReportsResponse<T> {
  reports: T[];
  page: number;
  limit: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch reports");
  }
  return res.json();
};

export function useAdminStreamReports(params: {
  status: string;
  page: number;
}) {
  const { status, page } = params;
  const url = `/api/admin/reports/stream?status=${status}&page=${page}`;

  return useSWR<ReportsResponse<StreamReport>>(url, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export function useAdminBugReports(params: {
  status: string;
  severity: string;
  page: number;
}) {
  const { status, severity, page } = params;
  const url = `/api/admin/reports/bug?status=${status}&severity=${severity}&page=${page}`;

  return useSWR<ReportsResponse<BugReport>>(url, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}
