"use client";

import type React from "react";
import { SWRConfig } from "swr";
import { PrivyProvider } from "@privy-io/react-auth";
import { AuthProvider } from "./auth/auth-provider";
import { ThemeProvider } from "@/contexts/theme-context";
import { StellarWalletProvider } from "@/contexts/stellar-wallet-context";

const swrCache = new Map();

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

if (!PRIVY_APP_ID) {
  throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set. Check your .env.local file.");
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
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          // Only allow Google login — no email/SMS magic links, no wallets via Privy
          loginMethods: ["google"],
          appearance: {
            theme: "dark",
            accentColor: "#ac39f2",
            logo: "/Images/streamFiLogo.svg",
          },
          // Never create embedded wallets through Privy — we manage Stellar custodial wallets ourselves
          embeddedWallets: {
            ethereum: { createOnLogin: "off" },
            solana: { createOnLogin: "off" },
          },
        }}
      >
        <StellarWalletProvider>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </StellarWalletProvider>
      </PrivyProvider>
    </SWRConfig>
  );
}
