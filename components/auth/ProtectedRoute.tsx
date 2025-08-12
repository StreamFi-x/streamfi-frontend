"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "@starknet-react/core"
import { useAuth } from "./auth-provider"
import ConnectWalletModal from "@/components/connectWallet"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { address, isConnected, status } = useAccount()
  const { isInitializing, isWalletConnecting } = useAuth()
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [hasCompletedInitialCheck, setHasCompletedInitialCheck] = useState(false)
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false)

  useEffect(() => {
    const checkAccess = () => {
      // Don't do anything while the auth system is initializing or wallet is connecting
      if (isInitializing || isWalletConnecting) {
        return
      }

      // Mark that we've completed the initial check
      if (!hasCompletedInitialCheck) {
        setHasCompletedInitialCheck(true)
      }

      // Check if auto-connect is enabled and we should wait for it
      const shouldAutoConnect = localStorage.getItem("starknet_auto_connect") === "true"
      const lastWalletId = localStorage.getItem("starknet_last_wallet")

      // If auto-connect is enabled and we haven't attempted it yet, wait a bit longer
      if (shouldAutoConnect && lastWalletId && !autoConnectAttempted && status === "disconnected") {
        // Set a timeout to give auto-connect more time
        setTimeout(() => {
          setAutoConnectAttempted(true)
        }, 3000) // Wait 3 seconds for auto-connect
        return
      }

      // Only after initialization is complete and auto-connect has been attempted, check wallet connection
      if (hasCompletedInitialCheck && (autoConnectAttempted || !shouldAutoConnect || !lastWalletId)) {
        if (!isConnected || !address) {
          setShowWalletModal(true)
        } else {
          setShowWalletModal(false) // Ensure modal is closed if wallet connects
        }
      }
    }

    checkAccess()
  }, [isConnected, address, status, isInitializing, isWalletConnecting, hasCompletedInitialCheck, autoConnectAttempted])

  // Handle redirection only if modal closes AND wallet is NOT connected AND auto-connect has been attempted
  useEffect(() => {
    const shouldAutoConnect = localStorage.getItem("starknet_auto_connect") === "true"
    const lastWalletId = localStorage.getItem("starknet_last_wallet")
    
    if (hasCompletedInitialCheck && !showWalletModal && (!isConnected || !address) && 
        (autoConnectAttempted || !shouldAutoConnect || !lastWalletId)) {
      router.replace("/explore")
    }
  }, [showWalletModal, isConnected, address, hasCompletedInitialCheck, autoConnectAttempted, router])

  // Show loading state during initialization or wallet connection
  if (isInitializing || isWalletConnecting || !hasCompletedInitialCheck) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading...</h2>
          <p className="text-gray-400">
            {isInitializing ? "Initializing application..." : "Connecting wallet..."}
          </p>
        </div>
      </div>
    )
  }

  // Show wallet connect modal if needed (only after initialization is complete)
  if (showWalletModal) {
    return (
      <ConnectWalletModal
        isModalOpen={showWalletModal}
        setIsModalOpen={setShowWalletModal}
      />
    )
  }

  // Only render children if wallet is connected
  if (!isConnected || !address) {
    return null
  }

  return <>{children}</>
}
