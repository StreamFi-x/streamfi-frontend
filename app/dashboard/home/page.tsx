"use client";


import { useAuth } from "@/components/auth/auth-provider";
import { TipHistory } from "@/components/tipping";
import { Loader2 } from "lucide-react";

function DashboardHome() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  if (!user?.username) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        Please complete your profile to view tip history.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your earnings and transaction history.
        </p>
      </div>

      <TipHistory username={user.username} />
    </div>
  );
}

export default DashboardHome;
