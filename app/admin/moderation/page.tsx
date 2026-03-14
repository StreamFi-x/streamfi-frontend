"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, XCircle, X } from "lucide-react";
import { useSWRConfig } from "swr";
import {
  useAdminStreamReports,
  useAdminBugReports,
  type StreamReport,
  type BugReport,
} from "@/hooks/admin/useAdminReports";

// ── Report detail panel ────────────────────────────────────────────────────────
function StreamReportDetail({
  report,
  onClose,
  onAction,
}: {
  report: StreamReport;
  onClose: () => void;
  onAction: (status: "reviewed" | "dismissed") => void;
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
          <h2 className="text-lg font-semibold text-foreground">
            Stream Report
          </h2>
          <button
            onClick={onClose}
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
            <dt className="text-muted-foreground">Reason</dt>
            <dd className="text-foreground">{report.reason}</dd>
          </div>
          {report.details && (
            <div>
              <dt className="text-muted-foreground">Details</dt>
              <dd className="text-foreground">{report.details}</dd>
            </div>
          )}
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
              onClick={() => onAction("reviewed")}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-highlight hover:bg-highlight/80 text-background text-sm font-medium"
            >
              <CheckCheck size={15} /> Mark Reviewed
            </button>
            <button
              onClick={() => onAction("dismissed")}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-surface-hover hover:bg-muted text-foreground text-sm font-medium"
            >
              <XCircle size={15} /> Dismiss
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function BugReportDetail({
  report,
  onClose,
  onAction,
}: {
  report: BugReport;
  onClose: () => void;
  onAction: (status: "reviewed" | "resolved") => void;
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
              onClick={() => onAction("reviewed")}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-highlight hover:bg-highlight/80 text-background text-sm font-medium"
            >
              <CheckCheck size={15} /> Mark Reviewed
            </button>
            <button
              onClick={() => onAction("resolved")}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-green-700 hover:bg-green-600 text-white text-sm font-medium"
            >
              <CheckCheck size={15} /> Resolve
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Badge helpers ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
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

function SeverityBadge({ severity }: { severity: string }) {
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

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminModerationPage() {
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

  const handleStreamAction = async (status: "reviewed" | "dismissed") => {
    if (!selectedStream) {
      return;
    }
    await fetch(`/api/admin/reports/stream/${selectedStream.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSelectedStream(null);
    mutate(
      key =>
        typeof key === "string" && key.startsWith("/api/admin/reports/stream"),
      undefined,
      { revalidate: true }
    );
  };

  const handleBugAction = async (status: "reviewed" | "resolved") => {
    if (!selectedBug) {
      return;
    }
    await fetch(`/api/admin/reports/bug/${selectedBug.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSelectedBug(null);
    mutate(
      key =>
        typeof key === "string" && key.startsWith("/api/admin/reports/bug"),
      undefined,
      { revalidate: true }
    );
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
                  <th className="px-4 py-3 font-medium">Streamer</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {streamLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
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
                      </tr>
                    ))
                  : streamReports.map(r => (
                      <tr
                        key={r.id}
                        className="border-b border-border hover:bg-surface-hover cursor-pointer transition-colors"
                        onClick={() => setSelectedStream(r)}
                      >
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
            onAction={handleStreamAction}
          />
        )}
        {selectedBug && (
          <BugReportDetail
            report={selectedBug}
            onClose={() => setSelectedBug(null)}
            onAction={handleBugAction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
