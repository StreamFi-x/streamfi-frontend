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

  useEffect(() => {
    const checkWallet = async () => {
      console.log("[ProtectedRoute] Checking wallet:", { isConnected, address });
      
      if (!isConnected || !address) {
        console.log("[ProtectedRoute] No wallet connection, redirecting to explore");
        router.replace("/explore");
      } else {
        console.log("[ProtectedRoute] Wallet connected, allowing access");
        setIsLoading(false);
      }
    };

    checkWallet();
  }, [isConnected, address, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading...</h2>
          <p className="text-gray-400">Please wait while we verify your wallet connection.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 