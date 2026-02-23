"use client";
import type React from "react";
import { useEffect } from "react";
import { SWRConfig } from "swr";
import { AuthProvider } from "./auth/auth-provider";
import { ThemeProvider } from "@/contexts/theme-context";
import { StellarWalletProvider } from "@/contexts/stellar-wallet-context";

const swrCache = new Map();

/** One-time cleanup of old starknet_* keys for returning users (Stellar migration). */
function StarknetKeyCleanup({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const remove = () => {
      try {
        if (localStorage.getItem("starknet_last_wallet")) {
          localStorage.removeItem("starknet_last_wallet");
          localStorage.removeItem("starknet_auto_connect");
        }
      } catch {
        // ignore
      }
    };
    remove();
    const timer = setTimeout(remove, 500);
    return () => clearTimeout(timer);
  }, []);
  return <>{children}</>;
}

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
      <ThemeProvider>
        <StellarWalletProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </StellarWalletProvider>
      </ThemeProvider>
    </SWRConfig>
  );
}
