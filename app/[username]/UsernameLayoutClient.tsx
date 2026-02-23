"use client";

import React, { useState, useEffect } from "react";
import { notFound, usePathname } from "next/navigation";
import { toast } from "sonner";

import Banner from "@/components/shared/profile/Banner";
import ProfileHeader from "@/components/shared/profile/ProfileHeader";
import TabsNavigation from "@/components/shared/profile/TabsNavigation";
import ViewStream from "@/components/stream/view-stream";

import ConnectWalletModal from "@/components/connectWallet";
import { TipModalContainer, TipCounter } from "@/components/tipping";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useTipModal } from "@/hooks/useTipModal";

interface UsernameLayoutClientProps {
  children: React.ReactNode;
  username: string;
}

export default function UsernameLayoutClient({
  children,
  username,
}: UsernameLayoutClientProps) {
  const pathname = usePathname();

  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<any>(null);

  const [userExists, setUserExists] = useState(true);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Use custom hooks for Stellar wallet and tip modal state
  const { publicKey: stellarPublicKey } = useStellarWallet();
  const tipModalState = useTipModal();

  const loggedInUsername =
    typeof window !== "undefined" ? sessionStorage.getItem("username") : null;

  const isDefaultRoute = pathname === `/${username}`;
  const isOwner = loggedInUsername === username;

  // Fetch user data and following state
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(`/api/users/${username}`);
        if (response.status === 404) {
          setUserExists(false);
          return;
        }

        const data = await response.json();
        setUserData(data.user);
        setIsLive(data.user.is_live || false);

        if (
          typeof window !== "undefined" &&
          sessionStorage.getItem("username")
        ) {
          const loggedInUser = sessionStorage.getItem("userData");
          const id = loggedInUser ? JSON.parse(loggedInUser).id : null;
          setIsFollowing(data.user.followers?.includes(id));
        }
      } catch {
        toast.error("Failed to fetch user data");
        setUserExists(false);
      }
    };

    fetchUserData();

    // Poll every 15 seconds to check for stream status changes
    const interval = setInterval(fetchUserData, 15000);
    return () => clearInterval(interval);
  }, [username]);

  // Handle follow
  const handleFollow = async () => {
    if (!loggedInUsername) {
      toast.error("You must be logged in to follow users.");
      setTimeout(() => {
        setShowWalletModal(true);
      }, 100);
      return;
    }

    setFollowLoading(true);
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerUsername: loggedInUsername,
          receiverUsername: username,
          action: "follow",
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setIsFollowing(true);
        toast.success("Followed successfully");

        setUserData((prev: any) => ({
          ...prev,
          followers: [...(prev.followers || []), loggedInUsername],
        }));
      } else {
        toast.error(result.error || "Failed to follow");
      }
    } catch {
      toast.error("Network error while following");
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle unfollow
  const handleUnfollow = async () => {
    if (!loggedInUsername) {
      toast.error("You must be logged in to unfollow users.");
      return;
    }

    setFollowLoading(true);
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerUsername: loggedInUsername,
          receiverUsername: username,
          action: "unfollow",
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setIsFollowing(false);
        toast.success("Unfollowed successfully");

        setUserData((prev: any) => ({
          ...prev,
          followers: (prev.followers || []).filter(
            (f: string) => f !== loggedInUsername
          ),
        }));
      } else {
        toast.error(result.error || "Failed to unfollow");
      }
    } catch {
      toast.error("Network error while unfollowing");
    } finally {
      setFollowLoading(false);
    }
  };

  if (!userExists) {
    return notFound();
  }

  if (isDefaultRoute && isLive) {
    return (
      <div className="flex flex-col h-screen bg-secondary text-foreground">
        <main className="flex-1 overflow-auto">
          <ViewStream
            username={username}
            isLive={true}
            onStatusChange={status => setIsLive(status)}
            isOwner={isOwner}
            userData={{
              ...userData,
              playbackId: userData?.mux_playback_id,
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-secondary text-foreground">
      <main className="flex-1 overflow-auto">
        <div className="bg-secondary min-h-screen">
          <Banner
            username={username}
            isLive={isDefaultRoute && !!isLive}
            streamTitle={
              userData?.creator?.streamTitle || userData?.creator?.title
            }
          />
          <ProfileHeader
            username={username}
            followers={userData?.followers?.length || 0}
            avatarUrl={userData?.avatar}
            isOwner={isOwner}
            isFollowing={isFollowing}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            followLoading={followLoading}
            stellarPublicKey={userData?.starknet_address}
            userStellarPublicKey={stellarPublicKey ?? undefined}
            onTipClick={tipModalState.openTipModal}
          />
          <TabsNavigation username={username} />
          <div className="p-4 space-y-6">
            <TipCounter
              username={username}
              variant="default"
              autoRefresh={true}
              refreshInterval={120000}
            />
            {children}
          </div>
        </div>
      </main>
      {showWalletModal && (
        <ConnectWalletModal
          isModalOpen={showWalletModal}
          setIsModalOpen={setShowWalletModal}
        />
      )}

      {/* Stellar Tip Modals */}
      <TipModalContainer
        isModalOpen={tipModalState.showTipModal}
        onModalClose={tipModalState.closeTipModal}
        recipientUsername={username}
        recipientPublicKey={userData?.starknet_address || ""}
        recipientAvatar={userData?.avatar}
        senderPublicKey={stellarPublicKey}
        onSuccess={tipModalState.showSuccess}
        onError={tipModalState.showError}
        confirmationState={tipModalState.tipConfirmation}
        onConfirmationClose={tipModalState.closeConfirmation}
        onRetry={tipModalState.retryFromConfirmation}
      />
    </div>
  );
}
