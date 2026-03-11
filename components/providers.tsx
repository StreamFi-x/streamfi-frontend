"use client";

import type React from "react";
import { SWRConfig } from "swr";
import { PrivyProvider } from "@privy-io/react-auth";
import { AuthProvider } from "./auth/auth-provider";
import { ThemeProvider } from "@/contexts/theme-context";
import { StellarWalletProvider } from "@/contexts/stellar-wallet-context";

const swrCache = new Map();

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

function InnerProviders({ children }: { children: React.ReactNode }) {
  return (
    <StellarWalletProvider>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </StellarWalletProvider>
  );
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
      {PRIVY_APP_ID ? (
        <PrivyProvider
          appId={PRIVY_APP_ID}
          config={{
            loginMethods: ["google"],
            appearance: {
              theme: "dark",
              accentColor: "#ac39f2",
              logo: "/Images/streamFiLogo.svg",
            },
            embeddedWallets: {
              ethereum: { createOnLogin: "off" },
              solana: { createOnLogin: "off" },
            },
          }}
        >
          <InnerProviders>{children}</InnerProviders>
        </PrivyProvider>
      ) : (
        <InnerProviders>{children}</InnerProviders>
      )}
    </SWRConfig>
  );
}
