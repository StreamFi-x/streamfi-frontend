"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useAuth } from "./auth-provider";
import ConnectWalletModal from "@/components/connectWallet";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const {
    publicKey,
    isConnected,
    isLoading: isStellarLoading,
    privyWallet,
  } = useStellarWallet();
  const { isInitializing, isWalletConnecting } = useAuth();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [hasCompletedInitialCheck, setHasCompletedInitialCheck] =
    useState(false);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  // Authenticated = Freighter wallet connected OR Privy (Google) session active
  const isAuthenticated = isConnected || !!privyWallet;

  useEffect(() => {
    const checkAccess = () => {
      // Privy users are always authenticated — skip all wallet checks
      if (privyWallet) {
        setHasCompletedInitialCheck(true);
        setShowWalletModal(false);
        return;
      }

      if (isInitializing || isWalletConnecting) {
        return;
      }

      if (!hasCompletedInitialCheck) {
        setHasCompletedInitialCheck(true);
      }

      const shouldAutoConnect =
        localStorage.getItem("stellar_auto_connect") === "true";
      const lastWalletId = localStorage.getItem("stellar_last_wallet");

      if (
        shouldAutoConnect &&
        lastWalletId &&
        !autoConnectAttempted &&
        !isConnected &&
        !isStellarLoading
      ) {
        setTimeout(() => {
          setAutoConnectAttempted(true);
        }, 3000);
        return;
      }

      if (
        hasCompletedInitialCheck &&
        (autoConnectAttempted || !shouldAutoConnect || !lastWalletId)
      ) {
        if (!isConnected || !publicKey) {
          setShowWalletModal(true);
        } else {
          setShowWalletModal(false);
        }
      }
    };

    checkAccess();
  }, [
    isConnected,
    publicKey,
    isStellarLoading,
    isInitializing,
    isWalletConnecting,
    hasCompletedInitialCheck,
    autoConnectAttempted,
    privyWallet,
  ]);

  useEffect(() => {
    // Never redirect Privy users
    if (privyWallet) {return;}

    const shouldAutoConnect =
      localStorage.getItem("stellar_auto_connect") === "true";
    const lastWalletId = localStorage.getItem("stellar_last_wallet");

    if (
      hasCompletedInitialCheck &&
      !showWalletModal &&
      (!isConnected || !publicKey) &&
      (autoConnectAttempted || !shouldAutoConnect || !lastWalletId)
    ) {
      router.replace("/explore");
    }
  }, [
    showWalletModal,
    isConnected,
    publicKey,
    hasCompletedInitialCheck,
    autoConnectAttempted,
    privyWallet,
    router,
  ]);

  // Privy users: render immediately — no loading screen needed
  if (privyWallet) {
    return <>{children}</>;
  }

  if (isInitializing || isWalletConnecting || !hasCompletedInitialCheck) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading...</h2>
          <p className="text-gray-400">
            {isInitializing
              ? "Initializing application..."
              : "Connecting wallet..."}
          </p>
        </div>
      </div>
    );
  }

  if (showWalletModal) {
    return (
      <ConnectWalletModal
        isModalOpen={showWalletModal}
        setIsModalOpen={setShowWalletModal}
      />
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
