"use client"

import type React from "react"
import { sepolia, mainnet } from "@starknet-react/chains"
import { StarknetConfig, publicProvider, argent, braavos, useInjectedConnectors, voyager } from "@starknet-react/core"
import { AuthProvider } from "./auth/auth-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Recommended connectors for StarkNet
    recommended: [argent(), braavos()],
    // Include all injected connectors
    includeRecommended: "onlyIfNoConnectors",
    // Order of connectors
    order: "random",
  })

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={publicProvider()}
      connectors={connectors}
      explorer={voyager}
      autoConnect={true} // Enable auto-connect for persistence
    >
      <AuthProvider>{children}</AuthProvider>
    </StarknetConfig>
  )
}
