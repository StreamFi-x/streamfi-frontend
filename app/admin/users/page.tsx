import UserManagementPanel from "@/components/admin/UserManagementPanel";

export default function AdminUsersPage() {
  const [filter, setFilter] = useState<"all" | "banned" | "live">("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [pendingAdminAction, setPendingAdminAction] = useState<PendingAdminAction | null>(null);
  const [securityError, setSecurityError] = useState("");
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
    setPendingAdminAction({ action: "admin_user_ban", userId: banTarget.id, operation: "ban", reason });
    setBanTarget(null);
  };

  const handleUnban = async (user: AdminUser) => {
    setPendingAdminAction({ action: "admin_user_ban", userId: user.id, operation: "unban" });
  };

  const handleCancelDeletion = async (user: AdminUser) => {
    await fetch(`/api/admin/users/${user.id}/deletion`, { method: "DELETE" });
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setPendingAdminAction({ action: "admin_user_delete", userId: deleteTarget.id, operation: "delete" });
    setDeleteTarget(null);
  };

  const handleStepUpApproved = async (challengeId: string, action: ProtectedAction) => {
    const pending = pendingAdminAction;
    if (!pending || pending.action !== action) {return;}
    setPendingAdminAction(null);
    setSecurityError("");
    try {
      const deleting = pending.operation === "delete";
      const response = await fetch(`/api/admin/users/${pending.userId}`, {
        method: deleting ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json", "x-step-up-challenge": challengeId },
        ...(deleting ? {} : { body: JSON.stringify({ action: pending.operation, reason: pending.reason }) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Admin action failed");
      }
      invalidate();
    } catch (cause) {
      setSecurityError(cause instanceof Error ? cause.message : "Admin action failed");
    }
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
      {securityError && <p role="alert" className="mb-4 text-sm text-red-600">{securityError}</p>}

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
                      {user.deleted_at ? (
                        <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded-full">
                          Pending deletion
                        </span>
                      ) : user.is_banned ? (
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
                        {user.deleted_at ? (
                          <button
                            onClick={() => handleCancelDeletion(user)}
                            className="p-1.5 rounded-md hover:bg-surface-hover text-amber-500 hover:text-amber-400"
                            title="Cancel deletion"
                          >
                            <RotateCcw size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteTarget(user)}
                            className="p-1.5 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-red-400"
                            title="Delete"
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
      {!isLoading && (page > 1 || users.length > 0) && (
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
            disabled={users.length < (data?.limit ?? 20)}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm bg-sidebar border border-border rounded-md text-foreground disabled:opacity-40 hover:bg-surface-hover"
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
      <StepUpDialog
        action={pendingAdminAction?.action ?? null}
        resourceId={pendingAdminAction?.userId ?? ""}
        onCancel={() => setPendingAdminAction(null)}
        onApproved={(challengeId, action) => void handleStepUpApproved(challengeId, action)}
      />
    </div>
  );
  return <UserManagementPanel />;
}
