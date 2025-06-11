"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "@starknet-react/core"
import ConnectWalletModal from "@/components/connectWallet"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const [isLoading, setIsLoading] = useState(true)
  const [hasChecked, setHasChecked] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [modalWasClosed, setModalWasClosed] = useState(false)

  useEffect(() => {
    const checkWallet = async () => {
      console.log("[ProtectedRoute] Checking wallet:", { isConnected, address })

      if (hasChecked) {
        if (!isConnected || !address) {
          // Show wallet connect modal instead of immediate redirect
          if (!showWalletModal && !modalWasClosed) {
            console.log("[ProtectedRoute] No wallet connection, showing connect modal")
            setShowWalletModal(true)
          } else if (modalWasClosed) {
            // Only redirect if the modal was closed without connecting
            console.log("[ProtectedRoute] Modal was closed without connecting, redirecting to explore")
            router.replace("/explore")
          }
        } else {
          console.log("[ProtectedRoute] Wallet connected, allowing access")
          setIsLoading(false)
          setShowWalletModal(false)
        }
      }

      setHasChecked(true)
    }

    checkWallet()
  }, [isConnected, address, router, hasChecked, showWalletModal, modalWasClosed])

  // Handle modal close without connection
  const handleModalClose = () => {
    setShowWalletModal(false)
    setModalWasClosed(true)
  }

  // If wallet connects while modal is open, this effect will catch it
  useEffect(() => {
    if (isConnected && address && showWalletModal) {
      setShowWalletModal(false)
      setIsLoading(false)
    }
  }, [isConnected, address, showWalletModal])

  // Show loading state while checking connection
  if (isLoading && hasChecked && !showWalletModal) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading...</h2>
          <p className="text-gray-400">Please wait while we verify your wallet connection.</p>
        </div>
      </div>
    )
  }

  // Show wallet connect modal if needed
  if (showWalletModal) {
    return <ConnectWalletModal isModalOpen={showWalletModal} setIsModalOpen={handleModalClose} />
  }

  // Only render children if wallet is connected
  if (!isConnected || !address) {
    return null
  }

  return <>{children}</>
}
