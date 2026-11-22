"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, XCircle, X, AlertTriangle } from "lucide-react";
import { useSWRConfig } from "swr";
import {
  useAdminStreamReports,
  useAdminStreamReportDetail,
  useAdminBugReports,
  type StreamReport,
  type BugReport,
} from "@/hooks/admin/useAdminReports";

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-900/40 text-yellow-400 border-yellow-800/40",
    reviewed: "bg-blue-900/40 text-blue-400 border-blue-800/40",
    dismissed: "bg-muted text-muted-foreground border-border",
    resolved: "bg-green-900/40 text-green-400 border-green-800/40",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border capitalize ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    low: "bg-muted text-muted-foreground border-border",
    medium: "bg-yellow-900/40 text-yellow-400 border-yellow-800/40",
    high: "bg-orange-900/40 text-orange-400 border-orange-800/40",
    critical: "bg-red-900/40 text-red-400 border-red-800/40",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border capitalize ${styles[severity] ?? styles.medium}`}
    >
      {severity}
    </span>
  );
}

export function StreamReportDetail({
  report,
  onClose,
  onAction,
  isSubmitting = false,
}: {
  report: StreamReport;
  onClose: () => void;
  onAction: (status: "reviewed" | "dismissed") => void;
  isSubmitting?: boolean;
}) {
  const { data: detailData, isLoading: flagsLoading } =
    useAdminStreamReportDetail(report.id);
  const flags = detailData?.flags ?? [];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-sidebar rounded-xl border border-border p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Stream Report
          </h2>
          <button
            onClick={onClose}
            aria-label="Close stream report detail"
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <dl className="space-y-3 text-sm mb-6">
          <div>
            <dt className="text-muted-foreground">Streamer</dt>
            <dd className="text-foreground font-medium">@{report.streamer}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stream ID</dt>
            <dd className="text-foreground font-mono text-xs">
              {report.stream_id}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reason</dt>
            <dd className="text-foreground">{report.reason}</dd>
          </div>
          {report.details && (
            <div>
              <dt className="text-muted-foreground">Details</dt>
              <dd className="text-foreground whitespace-pre-wrap">
                {report.details}
              </dd>
            </div>
          )}
          {report.priority === "expedited" && (
            <div>
              <dt className="text-muted-foreground">Priority</dt>
              <dd className="flex items-center gap-2 text-red-500 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Expedited: flagged by abuse-resistance signals (unusual volume
                and/or coordinated reporting accounts).
              </dd>
            </div>
          )}
          {flags.length > 0 && (
            <div>
              <dt className="text-muted-foreground mb-1">
                Priority Audit Signals
              </dt>
              <dd className="space-y-1.5">
                {flags.map((flag, idx) => (
                  <div
                    key={`${flag.signal}-${idx}`}
                    className="rounded-md border border-border bg-input px-3 py-2 text-xs"
                  >
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <AlertTriangle size={12} className="text-amber-400" />
                      {flag.signal}
                    </div>
                    {flag.detail && (
                      <div className="text-muted-foreground mt-0.5 break-words">
                        {typeof flag.detail === "string"
                          ? flag.detail
                          : JSON.stringify(flag.detail)}
                      </div>
                    )}
                  </div>
                ))}
              </dd>
            </div>
          )}
          {flagsLoading && report.priority === "expedited" && (
            <div className="text-xs text-muted-foreground">
              Loading priority signals…
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Reporter</dt>
            <dd className="text-foreground">
              {report.is_anonymous ? "Anonymous" : report.reporter_id}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge status={report.status} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reported</dt>
            <dd className="text-foreground">
              {new Date(report.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>

        {report.status === "pending" && (
          <div className="flex gap-3">
            <button
              disabled={isSubmitting}
              onClick={() => onAction("reviewed")}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-highlight hover:bg-highlight/80 text-background text-sm font-medium disabled:opacity-50"
            >
              <CheckCheck size={15} /> Mark Reviewed
            </button>
            <button
              disabled={isSubmitting}
              onClick={() => onAction("dismissed")}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-surface-hover hover:bg-muted text-foreground text-sm font-medium disabled:opacity-50"
            >
              <XCircle size={15} /> Dismiss
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function BugReportDetail({
  report,
  onClose,
  onAction,
  isSubmitting = false,
}: {
  report: BugReport;
  onClose: () => void;
  onAction: (status: "reviewed" | "resolved") => void;
  isSubmitting?: boolean;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-sidebar rounded-xl border border-border p-6 w-full max-w-lg mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Bug Report</h2>
          <button
            onClick={onClose}
            aria-label="Close bug report detail"
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <dl className="space-y-3 text-sm mb-6">
          <div>
            <dt className="text-muted-foreground">Category</dt>
            <dd className="text-foreground font-medium">{report.category}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Severity</dt>
            <dd>
              <SeverityBadge severity={report.severity} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Description</dt>
            <dd className="text-foreground whitespace-pre-wrap">
              {report.description}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reporter</dt>
            <dd className="text-foreground">{report.reporter_id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge status={report.status} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reported</dt>
            <dd className="text-foreground">
              {new Date(report.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>

        {report.status !== "resolved" && (
          <div className="flex gap-3">
            {report.status === "pending" && (
              <button
                disabled={isSubmitting}
                onClick={() => onAction("reviewed")}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-highlight hover:bg-highlight/80 text-background text-sm font-medium disabled:opacity-50"
              >
                <CheckCheck size={15} /> Mark Reviewed
              </button>
            )}
            <button
              disabled={isSubmitting}
              onClick={() => onAction("resolved")}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-green-700 hover:bg-green-600 text-white text-sm font-medium disabled:opacity-50"
            >
              <CheckCheck size={15} /> Resolve
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function ReportReviewPanel() {
  const [tab, setTab] = useState<"stream" | "bug">("stream");
  const [streamStatus, setStreamStatus] = useState("pending");
  const [bugStatus, setBugStatus] = useState("pending");
  const [bugSeverity, setBugSeverity] = useState("all");
  const [streamPage, setStreamPage] = useState(1);
  const [bugPage, setBugPage] = useState(1);
  const [selectedStream, setSelectedStream] = useState<StreamReport | null>(
    null
  );
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [actionError, setActionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutate } = useSWRConfig();

  const { data: streamData, isLoading: streamLoading } = useAdminStreamReports({
    status: streamStatus,
    page: streamPage,
  });
  const { data: bugData, isLoading: bugLoading } = useAdminBugReports({
    status: bugStatus,
    severity: bugSeverity,
    page: bugPage,
  });

  const streamReports = streamData?.reports ?? [];
  const bugReports = bugData?.reports ?? [];

  const updateStreamReportStatus = async (
    reportId: string,
    status: "reviewed" | "dismissed"
  ) => {
    setIsSubmitting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/reports/stream/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update stream report");
      }
      setSelectedStream(null);
      mutate(
        key =>
          typeof key === "string" &&
          key.startsWith("/api/admin/reports/stream"),
        undefined,
        { revalidate: true }
      );
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Failed to update stream report"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateBugReportStatus = async (
    reportId: string,
    status: "reviewed" | "resolved"
  ) => {
    setIsSubmitting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/reports/bug/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update bug report");
      }
      setSelectedBug(null);
      mutate(
        key =>
          typeof key === "string" && key.startsWith("/api/admin/reports/bug"),
        undefined,
        { revalidate: true }
      );
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Failed to update bug report"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const streamStatuses = ["pending", "reviewed", "dismissed", "all"];
  const bugStatuses = ["pending", "reviewed", "resolved", "all"];
  const severities = ["all", "critical", "high", "medium", "low"];

  return (
    <div className="p-6">
      <motion.h1
        className="text-2xl font-bold text-foreground mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Content Moderation
      </motion.h1>

      {actionError && (
        <p role="alert" className="mb-4 text-sm text-red-500">
          {actionError}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-sidebar rounded-lg p-1 border border-border w-fit mb-6">
        <button
          onClick={() => setTab("stream")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "stream"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Stream Reports
        </button>
        <button
          onClick={() => setTab("bug")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "bug"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Bug Reports
        </button>
      </div>

      {tab === "stream" && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {streamStatuses.map(s => (
              <button
                key={s}
                onClick={() => {
                  setStreamStatus(s);
                  setStreamPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  streamStatus === s
                    ? "bg-highlight text-background"
                    : "bg-sidebar border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="bg-sidebar rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium"></th>
                  <th className="px-4 py-3 font-medium">Streamer</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {streamLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3">
                          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  : streamReports.map(r => (
                      <tr
                        key={r.id}
                        className="border-b border-border hover:bg-surface-hover cursor-pointer transition-colors"
                        onClick={() => setSelectedStream(r)}
                      >
                        <td className="px-4 py-3">
                          {r.priority === "expedited" && (
                            <span
                              title="Expedited: flagged by automated abuse-resistance signals for prompt review"
                              className="inline-block h-2 w-2 rounded-full bg-red-500"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          @{r.streamer}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {r.reason}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={e => e.stopPropagation()}
                        >
                          {r.status === "pending" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() =>
                                  void updateStreamReportStatus(
                                    r.id,
                                    "reviewed"
                                  )
                                }
                                aria-label={`Review report for @${r.streamer}`}
                                className="px-2 py-1 text-xs rounded bg-highlight text-background hover:bg-highlight/80 disabled:opacity-50"
                              >
                                Review
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() =>
                                  void updateStreamReportStatus(
                                    r.id,
                                    "dismissed"
                                  )
                                }
                                aria-label={`Dismiss report for @${r.streamer}`}
                                className="px-2 py-1 text-xs rounded bg-surface-hover text-foreground hover:bg-muted disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!streamLoading && streamReports.length === 0 && (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No stream reports found.
              </div>
            )}
          </div>

          {/* Pagination */}
          {!streamLoading && streamReports.length === 20 && (
            <div className="flex justify-end gap-2 mt-4">
              <button
                disabled={streamPage === 1}
                onClick={() => setStreamPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-foreground disabled:opacity-40 hover:bg-surface-hover"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">
                Page {streamPage}
              </span>
              <button
                onClick={() => setStreamPage(p => p + 1)}
                className="px-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-foreground hover:bg-surface-hover"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "bug" && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex gap-2">
              {bugStatuses.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setBugStatus(s);
                    setBugPage(1);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    bugStatus === s
                      ? "bg-highlight text-background"
                      : "bg-sidebar border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {severities.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setBugSeverity(s);
                    setBugPage(1);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    bugSeverity === s
                      ? "bg-accent text-foreground border border-highlight/40"
                      : "bg-sidebar border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-sidebar rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    Severity
                  </th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bugLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  : bugReports.map(r => (
                      <tr
                        key={r.id}
                        className="border-b border-border hover:bg-surface-hover cursor-pointer transition-colors"
                        onClick={() => setSelectedBug(r)}
                      >
                        <td className="px-4 py-3 text-foreground font-medium">
                          {r.category}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <SeverityBadge severity={r.severity} />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={e => e.stopPropagation()}
                        >
                          {r.status !== "resolved" && (
                            <div className="flex items-center justify-end gap-1.5">
                              {r.status === "pending" && (
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    void updateBugReportStatus(r.id, "reviewed")
                                  }
                                  className="px-2 py-1 text-xs rounded bg-highlight text-background hover:bg-highlight/80 disabled:opacity-50"
                                >
                                  Review
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() =>
                                  void updateBugReportStatus(r.id, "resolved")
                                }
                                className="px-2 py-1 text-xs rounded bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
                              >
                                Resolve
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!bugLoading && bugReports.length === 0 && (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No bug reports found.
              </div>
            )}
          </div>

          {/* Pagination */}
          {!bugLoading && bugReports.length === 20 && (
            <div className="flex justify-end gap-2 mt-4">
              <button
                disabled={bugPage === 1}
                onClick={() => setBugPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-foreground disabled:opacity-40 hover:bg-surface-hover"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">
                Page {bugPage}
              </span>
              <button
                onClick={() => setBugPage(p => p + 1)}
                className="px-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-foreground hover:bg-surface-hover"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail panels */}
      <AnimatePresence>
        {selectedStream && (
          <StreamReportDetail
            report={selectedStream}
            onClose={() => setSelectedStream(null)}
            isSubmitting={isSubmitting}
            onAction={status =>
              void updateStreamReportStatus(selectedStream.id, status)
            }
          />
        )}
        {selectedBug && (
          <BugReportDetail
            report={selectedBug}
            onClose={() => setSelectedBug(null)}
            isSubmitting={isSubmitting}
            onAction={status =>
              void updateBugReportStatus(selectedBug.id, status)
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
