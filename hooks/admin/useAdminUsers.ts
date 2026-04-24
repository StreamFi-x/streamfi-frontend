import useSWR from "swr";

export interface AdminUser {
  id: string;
  username: string;
  avatar: string | null;
  email: string | null;
  is_live: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
  total_views: number;
}

interface AdminUsersResponse {
  users: AdminUser[];
  page: number;
  limit: number;
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
