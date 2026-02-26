"use client";

import React, { useEffect, useState } from "react";
import { TipCounter } from "@/components/tipping";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardHome() {
  const { publicKey } = useStellarWallet();
  const [username, setUsername] = useState<string | null>(null);

  // 1. Try to get username from session storage
  useEffect(() => {
    const storedUsername = sessionStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // 2. If no username, try to fetch user by wallet public key
  const { data: userData } = useSWR(
    !username && publicKey ? `/api/users/wallet/${publicKey}` : null,
    fetcher
  );

  useEffect(() => {
    if (userData?.user?.username) {
      setUsername(userData.user.username);
    }
  }, [userData]);

  const effectiveUsername = username || publicKey || "User";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Creator Dashboard</h1>
        <p className="text-muted-foreground text-sm">Manage your tipping and earnings.</p>
      </header>

      <div className="w-full">
        <TipCounter
          username={effectiveUsername}
          variant="large"
          showRefreshButton={true}
          autoRefresh={true}
          refreshInterval={60000}
        />
      </div>
    </div>
  );
}
