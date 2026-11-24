"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useToast } from "@/components/ui/toast-provider";

interface DeletionRecord {
  status: string;
  requested_at: string;
  purge_after: string;
  cancelled_at: string | null;
}

interface ExportJobState {
  exportId: string;
  status: "queued" | "ready" | "failed" | "timed_out";
  downloadUrl?: string;
  emailedAt?: string;
  error?: string;
}

const EXPORT_POLL_INTERVAL_MS = 1000;
const MAX_EXPORT_POLL_ATTEMPTS = 20;

export default function AccountDataSection() {
  const { user } = useAuth();
  const { publicKey, privyWallet } = useStellarWallet();
  const { showToast } = useToast();

  // Resolve current user identity for display & requests
  const [resolvedUsername, setResolvedUsername] = useState<string>("");
  const [resolvedAccountId, setResolvedAccountId] = useState<string>("");

  useEffect(() => {
    let username = user?.username || privyWallet?.username || "";
    let accountId =
      user?.id ||
      privyWallet?.id ||
      user?.wallet ||
      publicKey ||
      privyWallet?.wallet ||
      "";

    if (!username || !accountId) {
      try {
        const storedUser = sessionStorage.getItem("userData");
        const storedPrivy = sessionStorage.getItem("privy_user");
        const parsed = storedUser
          ? JSON.parse(storedUser)
          : storedPrivy
            ? JSON.parse(storedPrivy)
            : null;
        if (!username && parsed?.username) {
          username = parsed.username;
        }
        if (!username) {
          username = sessionStorage.getItem("username") || "";
        }
        if (!accountId && (parsed?.id || parsed?.wallet)) {
          accountId = parsed.id || parsed.wallet;
        }
      } catch {
        // Ignore malformed sessionStorage
      }
    }

    setResolvedUsername(username);
    setResolvedAccountId(accountId);
  }, [user, publicKey, privyWallet]);

  // ── Data Export state ──────────────────────────────────────────────────────
  const [exportJob, setExportJob] = useState<ExportJobState | null>(null);
  const [isRequestingExport, setIsRequestingExport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  const stopExportPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopExportPolling();
  }, [stopExportPolling]);

  const pollExportStatus = useCallback(
    async (exportId: string) => {
      try {
        const res = await fetch(
          `/api/routes-f/account-data-export?export_id=${encodeURIComponent(exportId)}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setExportError(data.error || "Unable to check export status.");
          stopExportPolling();
          return;
        }

        const data = await res.json();
        setExportJob({
          exportId,
          status: data.status,
          downloadUrl: data.download_url,
          emailedAt: data.emailed_at,
          error: data.error,
        });

        if (data.status === "ready") {
          stopExportPolling();
          showToast(
            "Your personal data export is ready to download.",
            "success"
          );
          return;
        }

        if (data.status === "failed") {
          stopExportPolling();
          setExportError(data.error || "Data export failed. Please try again.");
          return;
        }

        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current < MAX_EXPORT_POLL_ATTEMPTS) {
          pollTimerRef.current = setTimeout(() => {
            void pollExportStatus(exportId);
          }, EXPORT_POLL_INTERVAL_MS);
        } else {
          stopExportPolling();
          setExportJob(prev =>
            prev ? { ...prev, status: "timed_out" } : null
          );
        }
      } catch {
        stopExportPolling();
        setExportError("Network error while checking export status.");
      }
    },
    [showToast, stopExportPolling]
  );

  const handleRequestDataExport = async () => {
    const accountId = resolvedAccountId || resolvedUsername || "self";
    stopExportPolling();
    pollAttemptsRef.current = 0;
    setIsRequestingExport(true);
    setExportError(null);

    try {
      const res = await fetch("/api/routes-f/account-data-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ account_id: accountId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          data.error || "Failed to request data export. Please try again.";
        setExportError(message);
        showToast(message, "error");
        return;
      }

      setExportJob({
        exportId: data.export_id,
        status: data.status || "queued",
      });
      showToast(
        "Data export queued. We will prepare your archive shortly.",
        "success"
      );

      pollTimerRef.current = setTimeout(() => {
        void pollExportStatus(data.export_id);
      }, EXPORT_POLL_INTERVAL_MS);
    } catch {
      const message = "Network error — could not request data export.";
      setExportError(message);
      showToast(message, "error");
    } finally {
      setIsRequestingExport(false);
    }
  };

  // ── Account Deletion state ─────────────────────────────────────────────────
  const [deletionRecord, setDeletionRecord] = useState<DeletionRecord | null>(
    null
  );
  const [graceDays, setGraceDays] = useState<number>(30);
  const [isLoadingDeletionStatus, setIsLoadingDeletionStatus] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false);
  const [isCancellingDeletion, setIsCancellingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  const fetchDeletionStatus = useCallback(async () => {
    setIsLoadingDeletionStatus(true);
    try {
      const res = await fetch("/api/users/me/deletion", {
        method: "GET",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setDeletionRecord(data.deletion ?? null);
        if (typeof data.graceDays === "number" && data.graceDays > 0) {
          setGraceDays(data.graceDays);
        }
      }
    } catch {
      // Non-fatal: user can still view the section
    } finally {
      setIsLoadingDeletionStatus(false);
    }
  }, []);

  useEffect(() => {
    void fetchDeletionStatus();
  }, [fetchDeletionStatus]);

  const isPendingDeletion = deletionRecord?.status === "pending";

  const confirmationMatches = resolvedUsername
    ? confirmInput.trim().toLowerCase() === resolvedUsername.toLowerCase()
    : confirmInput.trim().length > 0;

  const openDeleteModal = () => {
    setConfirmInput("");
    setDeleteReason("");
    setDeletionError(null);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = useCallback(() => {
    if (isSubmittingDeletion) {
      return;
    }
    setIsDeleteModalOpen(false);
    setDeletionError(null);
  }, [isSubmittingDeletion]);

  useEffect(() => {
    if (!isDeleteModalOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDeleteModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleteModalOpen, closeDeleteModal]);

  const handleConfirmDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationMatches) {
      setDeletionError(
        resolvedUsername
          ? `Please type "${resolvedUsername}" to confirm account deletion.`
          : "Please enter your username to confirm account deletion."
      );
      return;
    }

    setIsSubmittingDeletion(true);
    setDeletionError(null);

    try {
      const res = await fetch("/api/users/me/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          confirm: confirmInput.trim(),
          reason: deleteReason.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          data.error ||
          "Failed to schedule account deletion. Please try again.";
        setDeletionError(message);
        showToast(message, "error");
        return;
      }

      setDeletionRecord({
        status: data.status || "pending",
        requested_at: new Date().toISOString(),
        purge_after: data.purgeAfter,
        cancelled_at: null,
      });
      setIsDeleteModalOpen(false);
      showToast(
        `Account scheduled for deletion. You have ${graceDays} days to cancel.`,
        "success"
      );
    } catch {
      const message = "Network error — could not submit deletion request.";
      setDeletionError(message);
      showToast(message, "error");
    } finally {
      setIsSubmittingDeletion(false);
    }
  };

  const handleCancelDeletion = async () => {
    setIsCancellingDeletion(true);
    setDeletionError(null);

    try {
      const res = await fetch("/api/users/me/deletion", {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          data.error || "Failed to cancel account deletion. Please try again.";
        setDeletionError(message);
        showToast(message, "error");
        return;
      }

      setDeletionRecord(null);
      showToast(
        "Account deletion cancelled. Your account is active.",
        "success"
      );
    } catch {
      const message = "Network error — could not cancel account deletion.";
      setDeletionError(message);
      showToast(message, "error");
    } finally {
      setIsCancellingDeletion(false);
    }
  };

  return (
    <div className="bg-secondary text-foreground min-h-screen pb-12">
      <div className="max-w-8xl mx-auto space-y-6">
        {/* Personal Data Export */}
        <section
          aria-labelledby="data-export-heading"
          className="bg-card border border-border shadow-sm rounded-lg p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <h2
                id="data-export-heading"
                className="text-highlight text-xl font-medium"
              >
                Export Your Personal Data
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Download a copy of your StreamFi account data, including your
                profile information, stream history, chat activity, tips, and
                preferences. Once prepared, a download link will appear here and
                be sent to your email address.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestDataExport}
              disabled={isRequestingExport || exportJob?.status === "queued"}
              className="bg-highlight hover:bg-highlight/80 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 shrink-0"
            >
              {isRequestingExport || exportJob?.status === "queued" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRequestingExport ? "Requesting..." : "Preparing Export..."}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Request Data Export
                </>
              )}
            </button>
          </div>

          {exportJob && (
            <div
              role="status"
              className="mt-4 rounded-md border border-border bg-input/60 p-4 text-sm space-y-2"
            >
              <div className="flex items-center gap-2 font-medium">
                {exportJob.status === "ready" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : exportJob.status === "failed" ? (
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                ) : exportJob.status === "timed_out" ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-highlight shrink-0" />
                )}
                <span>
                  {exportJob.status === "ready"
                    ? "Your data export is ready."
                    : exportJob.status === "failed"
                      ? "Data export failed."
                      : exportJob.status === "timed_out"
                        ? "Your data export is still being prepared. Check your email or check status again."
                        : "Your data export has been queued."}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Export ID:{" "}
                <code className="font-mono">{exportJob.exportId}</code>
              </p>
              {exportJob.status === "timed_out" && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      pollAttemptsRef.current = 0;
                      setExportError(null);
                      setExportJob(prev =>
                        prev ? { ...prev, status: "queued" } : null
                      );
                      void pollExportStatus(exportJob.exportId);
                    }}
                    className="inline-flex items-center gap-2 border border-border hover:bg-surface-hover text-foreground px-3 py-1.5 rounded-md text-xs font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Check Status
                  </button>
                </div>
              )}
              {exportJob.status === "ready" && exportJob.downloadUrl && (
                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <a
                    href={exportJob.downloadUrl}
                    download
                    className="inline-flex items-center gap-2 bg-highlight hover:bg-highlight/80 text-white px-4 py-2 rounded-md text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Data Archive
                  </a>
                  {exportJob.emailedAt && (
                    <span className="text-xs text-muted-foreground">
                      Ready since{" "}
                      {new Date(exportJob.emailedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {exportError && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {exportError}
            </p>
          )}
        </section>

        {/* Danger Zone — Account Deletion */}
        <section
          aria-labelledby="danger-zone-heading"
          className="bg-card border border-red-500/40 shadow-sm rounded-lg p-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <h2
              id="danger-zone-heading"
              className="text-red-500 text-xl font-semibold"
            >
              Danger Zone
            </h2>
          </div>

          <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
            Permanently delete your StreamFi account and associated personal
            data. Once requested, your account enters a{" "}
            <strong className="text-foreground">
              {graceDays}-day grace period
            </strong>{" "}
            during which you can cancel the deletion. After the grace period
            ends, your profile, stream keys, and personal information will be
            permanently erased and cannot be recovered.
          </p>

          {isLoadingDeletionStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking account deletion status...
            </div>
          ) : isPendingDeletion ? (
            <div
              role="status"
              className="rounded-md border border-yellow-500/40 bg-yellow-950/30 p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-yellow-200">
                    Account deletion is pending
                  </p>
                  <p className="text-xs text-yellow-200/80">
                    Your account is scheduled to be permanently purged on{" "}
                    <strong>
                      {deletionRecord?.purge_after
                        ? new Date(
                            deletionRecord.purge_after
                          ).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "the end of the grace period"}
                    </strong>
                    . You can cancel this request at any time before then.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelDeletion}
                disabled={isCancellingDeletion}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-foreground px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
              >
                {isCancellingDeletion ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {isCancellingDeletion
                  ? "Cancelling..."
                  : "Cancel Account Deletion"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-border pt-4">
              <div>
                <h3 className="text-foreground font-medium text-base">
                  Delete Account
                </h3>
                <p className="text-muted-foreground text-xs mt-1">
                  Export your data first if you want a copy before deletion.
                </p>
              </div>
              <button
                type="button"
                onClick={openDeleteModal}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            </div>
          )}

          {deletionError && !isDeleteModalOpen && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {deletionError}
            </p>
          )}
        </section>
      </div>

      {/* Destructive Account Deletion Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={closeDeleteModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-modal-title"
        >
          <div
            className="bg-modal border border-red-500/30 shadow-xl rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <h3
                  id="delete-account-modal-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Confirm Account Deletion
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isSubmittingDeletion}
                aria-label="Close deletion confirmation"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-md border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-200 space-y-1.5">
              <p className="font-semibold">This action is destructive.</p>
              <p>
                Your account will be deactivated immediately and permanently
                deleted after the {graceDays}-day grace period unless you cancel
                it beforehand.
              </p>
            </div>

            <form onSubmit={handleConfirmDeletion} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="delete-confirm-username"
                  className="block text-sm text-foreground"
                >
                  {resolvedUsername ? (
                    <>
                      Type{" "}
                      <strong className="font-mono text-red-400">
                        {resolvedUsername}
                      </strong>{" "}
                      to confirm
                    </>
                  ) : (
                    "Type your username to confirm"
                  )}
                </label>
                <input
                  id="delete-confirm-username"
                  type="text"
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder={resolvedUsername || "Enter your username"}
                  autoComplete="off"
                  disabled={isSubmittingDeletion}
                  className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="delete-reason"
                  className="block text-sm text-muted-foreground"
                >
                  Reason for leaving (optional)
                </label>
                <textarea
                  id="delete-reason"
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={isSubmittingDeletion}
                  placeholder="Let us know why you are deleting your account"
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-highlight resize-none"
                />
              </div>

              {deletionError && (
                <p role="alert" className="text-xs text-red-400">
                  {deletionError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={isSubmittingDeletion}
                  className="flex-1 border border-border hover:bg-surface-hover text-foreground py-2.5 rounded-md text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!confirmationMatches || isSubmittingDeletion}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  {isSubmittingDeletion ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Confirm Account Deletion"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
