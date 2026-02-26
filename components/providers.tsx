"use client";

import type React from "react";
import { SWRConfig } from "swr";
import { AuthProvider } from "./auth/auth-provider";
import { ThemeProvider } from "@/contexts/theme-context";
import { StellarWalletProvider } from "@/contexts/stellar-wallet-context";

const swrCache = new Map();


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 10000,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        provider: () => swrCache,
      }}
    >
      <StellarWalletProvider>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </StellarWalletProvider>
    </SWRConfig>
  );
}
