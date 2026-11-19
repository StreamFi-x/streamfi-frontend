import useSWR from "swr";

export interface AdminUser {
  id: string;
  username: string;
  avatar: string | null;
  email: string | null;
  is_live: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  /** Set while the account is pending deletion (tombstoned). */
  deleted_at: string | null;
  created_at: string;
  total_views: number;
}

export interface AdminDeletionRecord {
  id: string;
  user_id: string;
  username: string;
  status: "pending" | "cancelled" | "purging" | "failed" | "purged";
  requested_at: string;
  requested_by_type: "self" | "admin";
  requested_by: string | null;
  reason: string | null;
  purge_after: string;
  legal_hold: boolean;
  legal_hold_reason: string | null;
  attempts: number;
  completed_steps: string[];
  last_error: string | null;
  purged_at: string | null;
}

interface AdminUsersResponse {
  users: AdminUser[];
  page: number;
  limit: number;
}

interface AdminDeletionsResponse {
  deletions: AdminDeletionRecord[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch users");
  }
  return res.json();
};

export function useAdminUsers(params: {
  page: number;
  filter: "all" | "banned" | "live";
  q: string;
}) {
  const { page, filter, q } = params;
  const url = `/api/admin/users?page=${page}&filter=${filter}&q=${encodeURIComponent(q)}`;

  return useSWR<AdminUsersResponse>(url, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export function useAdminUserDeletions(status: string | null = null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const url = `/api/admin/users/deletions${query}`;

  return useSWR<AdminDeletionsResponse>(url, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
}
