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

  useEffect(() => {
    const checkAccess = () => {
      console.log("[ProtectedRoute] Checking access:", {
        isConnected,
        address,
        status,
        isInitializing,
        isWalletConnecting,
        hasCompletedInitialCheck,
      })

      // Don't do anything while the auth system is initializing or wallet is connecting
      if (isInitializing || isWalletConnecting) {
        return
      }

      // Mark that we've completed the initial check
      if (!hasCompletedInitialCheck) {
        setHasCompletedInitialCheck(true)
      }

      // Only after initialization is complete, check wallet connection
      if (hasCompletedInitialCheck || (!isInitializing && !isWalletConnecting)) {
        if (!isConnected || !address) {
          console.log("[ProtectedRoute] No wallet connection after initialization, showing connect modal")
          setShowWalletModal(true)
        } else {
          console.log("[ProtectedRoute] Wallet connected, allowing access")
          setShowWalletModal(false) // Ensure modal is closed if wallet connects
        }
      }
    }

    checkAccess()
  }, [isConnected, address, status, isInitializing, isWalletConnecting, hasCompletedInitialCheck])

  // New useEffect to handle redirection only if modal closes AND wallet is NOT connected
  useEffect(() => {
    if (hasCompletedInitialCheck && !showWalletModal && (!isConnected || !address)) {
      console.log("[ProtectedRoute] Modal closed without connection, redirecting to explore")
      router.replace("/explore")
    }
  }, [showWalletModal, isConnected, address, hasCompletedInitialCheck, router])

  // Show loading state during initialization or wallet connection
  if (isInitializing || isWalletConnecting || !hasCompletedInitialCheck) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading...</h2>
          <p className="text-gray-400">{isInitializing ? "Initializing application..." : "Connecting wallet..."}</p>
        </div>
      </div>
    )
  }

  // Show wallet connect modal if needed (only after initialization is complete)
  if (showWalletModal) {
    return (
      <ConnectWalletModal
        isModalOpen={showWalletModal}
        setIsModalOpen={setShowWalletModal} // Pass setShowWalletModal directly
      />
    )
  }

  // Only render children if wallet is connected
  if (!isConnected || !address) {
    return null
  }

  return <>{children}</>
}
