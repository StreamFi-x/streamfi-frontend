"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@starknet-react/core";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const [isLoading, setIsLoading] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkWallet = async () => {
      console.log("[ProtectedRoute] Checking wallet:", { isConnected, address });
      
      // Only redirect if we've checked and there's no connection
      if (hasChecked && (!isConnected || !address)) {
        console.log("[ProtectedRoute] No wallet connection, redirecting to explore");
        router.replace("/explore");
      } else if (isConnected && address) {
        console.log("[ProtectedRoute] Wallet connected, allowing access");
        setIsLoading(false);
      }
      
      setHasChecked(true);
    };

    checkWallet();
  }, [isConnected, address, router, hasChecked]);

  // Show loading state while checking connection
  if (isLoading || !hasChecked) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading...</h2>
          <p className="text-gray-400">Please wait while we verify your wallet connection.</p>
        </div>
      </div>
    );
  }

  // Only render children if wallet is connected
  if (!isConnected || !address) {
    return null;
  }

  return <>{children}</>;
} 