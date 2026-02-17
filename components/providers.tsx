"use client";
import type React from "react";
import { SWRConfig } from "swr";
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  publicProvider,
  argent,
  braavos,
  useInjectedConnectors,
  voyager,
} from "@starknet-react/core";
import { AuthProvider } from "./auth/auth-provider";

import { ThemeProvider } from "@/contexts/theme-context";

// Create a stable cache instance outside the component to ensure proper cache sharing
const swrCache = new Map();

export function Providers({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Recommended connectors for StarkNet

    recommended: [argent(), braavos()],
    // Include all injected connectors
    includeRecommended: "always",
    // Order of connectors

    order: "alphabetical",
  });

  return (
    <SWRConfig
      value={{
        // Global SWR configuration for optimal performance
        dedupingInterval: 10000, // Deduplicate requests within 10 seconds
        revalidateOnFocus: false, // Don't refetch on window focus
        revalidateOnReconnect: true, // Refetch on network reconnect
        shouldRetryOnError: false, // Don't retry on error by default
        // Use stable cache instance for proper cache sharing across all components
        provider: () => swrCache,
      }}
    >
      <StarknetConfig
        chains={[mainnet, sepolia]}
        provider={publicProvider()}
        connectors={connectors}
        explorer={voyager}
        autoConnect={true}
      >
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </StarknetConfig>
    </SWRConfig>
  );
}
