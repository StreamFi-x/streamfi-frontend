"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { ShieldX } from "lucide-react";

interface Props {
  children: ReactNode;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Unauthorized");
  }
  return res.json();
};

export default function AdminProtectedRoute({ children }: Props) {
  const { data, error, isLoading } = useSWR("/api/admin/me", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-highlight" />
          <p className="text-sm text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <ShieldX className="h-16 w-16 text-red-500" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground max-w-sm">
            You do not have permission to access the admin panel. If you believe
            this is an error, contact the platform administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
