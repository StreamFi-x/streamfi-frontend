"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Ban, CheckCircle, Trash2 } from "lucide-react";
import { useSWRConfig } from "swr";
import { useAdminUsers, type AdminUser } from "@/hooks/admin/useAdminUsers";
import { getDefaultAvatar } from "@/lib/profile-icons";

// ── Ban confirm dialog ─────────────────────────────────────────────────────────
function BanConfirmDialog({
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
        <label className="block text-sm text-muted-foreground mb-1">
          Reason (optional)
        </label>
        <textarea
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

// ── Delete confirm dialog ──────────────────────────────────────────────────────
function DeleteConfirmDialog({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  onClose: () => void;
  onConfirm: () => void;
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
          This action is permanent and cannot be undone. All user data will be
          deleted.
        </p>
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm bg-surface-hover text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-sm bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            Permanently Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [filter, setFilter] = useState<"all" | "banned" | "live">("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useAdminUsers({ page, filter, q: debouncedQ });
  const users = data?.users ?? [];

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
    await fetch(`/api/admin/users/${banTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ban", reason }),
    });
    setBanTarget(null);
    invalidate();
  };

  const handleUnban = async (user: AdminUser) => {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unban" }),
    });
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    invalidate();
  };

  const filterTabs: { label: string; value: "all" | "banned" | "live" }[] = [
    { label: "All", value: "all" },
    { label: "Live", value: "live" },
    { label: "Banned", value: "banned" },
  ];

  return (
    <div className="p-6">
      <motion.h1
        className="text-2xl font-bold text-foreground mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        User Management
      </motion.h1>

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
            className="w-full bg-input text-foreground rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-highlight border border-border"
          />
          {q && (
            <button
              onClick={() => setQ("")}
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
                          src={user.avatar || getDefaultAvatar(user.username)}
                          alt={user.username ?? "User avatar"}
                          width={32}
                          height={32}
                          className="rounded-full object-cover shrink-0"
                          unoptimized
                        />
                        <span className="font-medium text-foreground truncate max-w-[140px]">
                          @{user.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {user.is_banned ? (
                        <span className="text-xs bg-red-900/40 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full">
                          Banned
                        </span>
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
                          >
                            <CheckCircle size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setBanTarget(user)}
                            className="p-1.5 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-red-400"
                            title="Ban"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="p-1.5 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
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
    </div>
  );
}
