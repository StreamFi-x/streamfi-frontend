"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Ban,
  CheckCircle,
  Trash2,
  RotateCcw,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { useSWRConfig } from "swr";
import {
  useAdminUsers,
  useAdminUserDeletions,
  type AdminUser,
  type AdminDeletionRecord,
} from "@/hooks/admin/useAdminUsers";
import { getDefaultAvatar } from "@/lib/profile-icons";
import StepUpDialog, {
  type ProtectedAction,
} from "@/components/settings/privacy-and-security/step-up-dialog";

type PendingAdminAction = {
  action: "admin_user_ban" | "admin_user_delete";
  userId: string;
  operation: "ban" | "unban" | "delete";
  reason?: string;
};

export function BanConfirmDialog({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-sidebar rounded-xl border border-border p-6 w-full max-w-md mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Ban @{user.username}?
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          This user will be blocked from streaming and interacting on the
          platform.
        </p>
        <label
          htmlFor="ban-reason-input"
          className="block text-sm text-muted-foreground mb-1"
        >
          Reason (optional)
        </label>
        <textarea
          id="ban-reason-input"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Describe the violation…"
          className="w-full bg-input text-foreground rounded-lg p-3 text-sm resize-none min-h-[80px] outline-none focus:ring-1 focus:ring-highlight border border-border"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm bg-surface-hover text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 rounded-md text-sm bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            Ban User
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function DeleteConfirmDialog({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-sidebar rounded-xl border border-border p-6 w-full max-w-md mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Delete @{user.username}?
        </h2>
        <p className="text-sm text-red-400 mb-4">
          The account is hidden immediately and permanently purged after the
          grace period. Until then the deletion can be cancelled from this page.
          Financial records are kept without personal data.
        </p>
        <label
          htmlFor="delete-reason-input"
          className="block text-sm text-muted-foreground mb-1"
        >
          Reason (optional)
        </label>
        <textarea
          id="delete-reason-input"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for account deletion…"
          className="w-full bg-input text-foreground rounded-lg p-3 text-sm resize-none min-h-[70px] outline-none focus:ring-1 focus:ring-highlight border border-border"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm bg-surface-hover text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 rounded-md text-sm bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            Delete Account
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function UserManagementPanel() {
  const [viewMode, setViewMode] = useState<"users" | "deletions">("users");
  const [filter, setFilter] = useState<"all" | "banned" | "live">("all");
  const [deletionStatus, setDeletionStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [pendingAdminAction, setPendingAdminAction] =
    useState<PendingAdminAction | null>(null);
  const [securityError, setSecurityError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useAdminUsers({ page, filter, q: debouncedQ });
  const { data: deletionsData, isLoading: deletionsLoading } =
    useAdminUserDeletions(
      viewMode === "deletions" ? deletionStatus || null : null
    );

  const users = data?.users ?? [];
  const deletions = deletionsData?.deletions ?? [];

  const invalidate = useCallback(() => {
    mutate(
      key => typeof key === "string" && key.startsWith("/api/admin/users"),
      undefined,
      { revalidate: true }
    );
  }, [mutate]);

  const handleBan = async (reason: string) => {
    if (!banTarget) {
      return;
    }
    setPendingAdminAction({
      action: "admin_user_ban",
      userId: banTarget.id,
      operation: "ban",
      reason,
    });
    setBanTarget(null);
  };

  const handleUnban = async (user: AdminUser) => {
    setPendingAdminAction({
      action: "admin_user_ban",
      userId: user.id,
      operation: "unban",
    });
  };

  const handleCancelDeletion = async (userId: string) => {
    setSecurityError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/deletion`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to cancel account deletion");
      }
      setActionSuccess("Account deletion cancelled.");
      invalidate();
    } catch (cause) {
      setSecurityError(
        cause instanceof Error ? cause.message : "Failed to cancel deletion"
      );
    }
  };

  const handleToggleLegalHold = async (record: AdminDeletionRecord) => {
    setSecurityError("");
    setActionSuccess("");
    try {
      const nextHold = !record.legal_hold;
      const res = await fetch(`/api/admin/users/${record.user_id}/deletion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalHold: nextHold,
          reason: nextHold ? "Placed by admin from dashboard" : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update legal hold");
      }
      setActionSuccess(
        nextHold ? "Legal hold placed on deletion." : "Legal hold lifted."
      );
      invalidate();
    } catch (cause) {
      setSecurityError(
        cause instanceof Error ? cause.message : "Failed to update legal hold"
      );
    }
  };

  const handleRetryPurge = async (record: AdminDeletionRecord) => {
    setSecurityError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/admin/users/${record.user_id}/deletion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to retry purge");
      }
      setActionSuccess("Purge attempts reset for retry.");
      invalidate();
    } catch (cause) {
      setSecurityError(
        cause instanceof Error ? cause.message : "Failed to retry purge"
      );
    }
  };

  const handleDelete = async (reason: string) => {
    if (!deleteTarget) {
      return;
    }
    setPendingAdminAction({
      action: "admin_user_delete",
      userId: deleteTarget.id,
      operation: "delete",
      reason,
    });
    setDeleteTarget(null);
  };

  const handleStepUpApproved = async (
    challengeId: string,
    action: ProtectedAction
  ) => {
    const pending = pendingAdminAction;
    if (!pending || pending.action !== action) {
      return;
    }
    setPendingAdminAction(null);
    setSecurityError("");
    setActionSuccess("");
    try {
      const deleting = pending.operation === "delete";
      const deleteQuery =
        deleting && pending.reason
          ? `?reason=${encodeURIComponent(pending.reason)}`
          : "";
      const response = await fetch(
        `/api/admin/users/${pending.userId}${deleteQuery}`,
        {
          method: deleting ? "DELETE" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-step-up-challenge": challengeId,
          },
          ...(deleting
            ? {}
            : {
                body: JSON.stringify({
                  action: pending.operation,
                  reason: pending.reason,
                }),
              }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Admin action failed");
      }
      setActionSuccess(
        deleting
          ? "Account scheduled for deletion."
          : pending.operation === "ban"
            ? "User banned."
            : "User unbanned."
      );
      invalidate();
    } catch (cause) {
      setSecurityError(
        cause instanceof Error ? cause.message : "Admin action failed"
      );
    }
  };

  const filterTabs: { label: string; value: "all" | "banned" | "live" }[] = [
    { label: "All", value: "all" },
    { label: "Live", value: "live" },
    { label: "Banned", value: "banned" },
  ];

  const deletionStatuses = [
    { label: "Open (Pending / Failed)", value: "" },
    { label: "Pending", value: "pending" },
    { label: "Purging", value: "purging" },
    { label: "Failed", value: "failed" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Purged", value: "purged" },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          User Management
        </motion.h1>

        <div className="flex gap-1 bg-sidebar rounded-lg p-1 border border-border w-fit">
          <button
            type="button"
            onClick={() => setViewMode("users")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "users"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Directory
          </button>
          <button
            type="button"
            onClick={() => setViewMode("deletions")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "deletions"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Deletion Queue
          </button>
        </div>
      </div>

      {securityError && (
        <p role="alert" className="mb-4 text-sm text-red-500">
          {securityError}
        </p>
      )}
      {actionSuccess && (
        <p role="status" className="mb-4 text-sm text-green-400">
          {actionSuccess}
        </p>
      )}

      {viewMode === "users" ? (
        <>
          {/* Filter tabs + search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex gap-1 bg-sidebar rounded-lg p-1 border border-border">
              {filterTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setFilter(tab.value);
                    setPage(1);
                  }}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filter === tab.value
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={15}
              />
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search username…"
                aria-label="Search username"
                className="w-full bg-input text-foreground rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-highlight border border-border"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-sidebar rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">
                    Views
                  </th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">
                    Joined
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                            <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="h-4 w-14 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="h-4 w-10 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  : users.map(user => (
                      <tr
                        key={user.id}
                        className="border-b border-border hover:bg-surface-hover transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Image
                              src={
                                user.avatar || getDefaultAvatar(user.username)
                              }
                              alt={user.username ?? "User avatar"}
                              width={32}
                              height={32}
                              className="rounded-full object-cover shrink-0"
                              unoptimized
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-foreground truncate block max-w-[160px]">
                                @{user.username}
                              </span>
                              {user.email && (
                                <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                                  {user.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {user.deleted_at ? (
                            <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded-full">
                              Pending deletion
                            </span>
                          ) : user.is_banned ? (
                            <div>
                              <span className="text-xs bg-red-900/40 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full">
                                Banned
                              </span>
                              {user.ban_reason && (
                                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[180px]">
                                  {user.ban_reason}
                                </p>
                              )}
                            </div>
                          ) : user.is_live ? (
                            <span className="text-xs bg-green-900/40 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full">
                              Live
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Offline
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {(user.total_views ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {user.is_banned ? (
                              <button
                                onClick={() => handleUnban(user)}
                                className="p-1.5 rounded-md hover:bg-surface-hover text-green-500 hover:text-green-400"
                                title="Unban"
                                aria-label={`Unban @${user.username}`}
                              >
                                <CheckCircle size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setBanTarget(user)}
                                className="p-1.5 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-red-400"
                                title="Ban"
                                aria-label={`Ban @${user.username}`}
                              >
                                <Ban size={16} />
                              </button>
                            )}
                            {user.deleted_at ? (
                              <button
                                onClick={() => handleCancelDeletion(user.id)}
                                className="p-1.5 rounded-md hover:bg-surface-hover text-amber-500 hover:text-amber-400"
                                title="Cancel deletion"
                                aria-label={`Cancel deletion for @${user.username}`}
                              >
                                <RotateCcw size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setDeleteTarget(user)}
                                className="p-1.5 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-red-400"
                                title="Delete"
                                aria-label={`Delete @${user.username}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {!isLoading && users.length === 0 && (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No users found.
              </div>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && (data?.limit ?? 0) === 20 && users.length === 20 && (
            <div className="flex justify-end gap-2 mt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-foreground disabled:opacity-40 hover:bg-surface-hover"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">
                Page {page}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-foreground hover:bg-surface-hover"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {deletionStatuses.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => setDeletionStatus(item.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  deletionStatus === item.value
                    ? "bg-highlight text-background"
                    : "bg-sidebar border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="bg-sidebar rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    Purge After
                  </th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">
                    Legal Hold
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deletionsLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  : deletions.map(record => (
                      <tr
                        key={record.id}
                        className="border-b border-border hover:bg-surface-hover transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          @{record.username}
                          {record.reason && (
                            <p className="text-xs text-muted-foreground font-normal">
                              {record.reason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize px-2 py-0.5 rounded-full border border-border bg-muted text-foreground">
                            {record.status}
                          </span>
                          {record.last_error && (
                            <p className="text-xs text-red-400 mt-1 max-w-xs truncate">
                              {record.last_error}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                          {new Date(record.purge_after).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {record.legal_hold ? (
                            <span className="text-xs bg-red-900/40 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full">
                              On Hold
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              None
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {["pending", "purging", "failed"].includes(
                              record.status
                            ) && (
                              <button
                                type="button"
                                onClick={() => handleToggleLegalHold(record)}
                                className="px-2.5 py-1 rounded-md text-xs bg-surface-hover hover:bg-muted text-foreground flex items-center gap-1"
                              >
                                <ShieldAlert size={13} />
                                {record.legal_hold ? "Lift Hold" : "Legal Hold"}
                              </button>
                            )}
                            {record.status === "failed" && (
                              <button
                                type="button"
                                onClick={() => handleRetryPurge(record)}
                                className="px-2.5 py-1 rounded-md text-xs bg-highlight text-background hover:bg-highlight/80 flex items-center gap-1"
                              >
                                <RefreshCw size={13} /> Retry Purge
                              </button>
                            )}
                            {["pending", "failed"].includes(record.status) && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCancelDeletion(record.user_id)
                                }
                                className="px-2.5 py-1 rounded-md text-xs bg-amber-900/40 text-amber-300 hover:bg-amber-900/60 flex items-center gap-1"
                              >
                                <RotateCcw size={13} /> Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {!deletionsLoading && deletions.length === 0 && (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No account deletion records found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AnimatePresence>
        {banTarget && (
          <BanConfirmDialog
            user={banTarget}
            onClose={() => setBanTarget(null)}
            onConfirm={handleBan}
          />
        )}
        {deleteTarget && (
          <DeleteConfirmDialog
            user={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
      <StepUpDialog
        action={pendingAdminAction?.action ?? null}
        resourceId={pendingAdminAction?.userId ?? ""}
        onCancel={() => setPendingAdminAction(null)}
        onApproved={(challengeId, action) =>
          void handleStepUpApproved(challengeId, action)
        }
      />
    </div>
  );
}
