"use client";

import React, { useState, useEffect } from "react";
import { notFound, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import Banner from "@/components/shared/profile/Banner";
import ProfileHeader from "@/components/shared/profile/ProfileHeader";
import TabsNavigation from "@/components/shared/profile/TabsNavigation";

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
  const router = useRouter();

  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<any>(null);

  const [userExists, setUserExists] = useState(true);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  // Populated in useEffect to avoid SSR/client sessionStorage mismatch
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  // Use custom hooks for Stellar wallet and tip modal state
  const { publicKey, privyWallet } = useStellarWallet();
  const stellarPublicKey = publicKey || privyWallet?.wallet || null;
  const tipModalState = useTipModal();

  useEffect(() => {
    setLoggedInUsername(sessionStorage.getItem("username"));
  }, []);

  const isDefaultRoute = pathname === `/${username}`;
  const isWatchRoute = pathname === `/${username}/watch`;
  // Any clip detail page (e.g. /username/clips/some-id) — not the /clips index itself
  const isClipRoute = pathname.startsWith(`/${username}/clips/`);
  const isOwner = loggedInUsername?.toLowerCase() === username.toLowerCase();

  // When the user visits /{username} and they're live, redirect to the canonical watch URL.
  // Use window.location to avoid the RSC fetch that router.replace() triggers, which can
  // fail with "Failed to fetch" when Turbopack hasn't compiled the route yet.
  useEffect(() => {
    if (isDefaultRoute && isLive === true) {
      window.location.replace(`/${username}/watch`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDefaultRoute, isLive, username]);

  // Fetch user data — viewer_username lets the API return is_following from the join table
  const fetchUserData = async (viewer?: string | null) => {
    try {
      const viewerParam = viewer ?? loggedInUsername ?? "";
      const url = `/api/users/${username}${viewerParam ? `?viewer_username=${encodeURIComponent(viewerParam)}` : ""}`;
      const response = await fetch(url, { cache: "no-store" });

      // Only a true 404 means the user doesn't exist
      if (response.status === 404) {
        setUserExists(false);
        return;
      }

      // Any other non-OK response (500, DB timeout, etc.) is transient — keep
      // showing whatever data we already have; never redirect to 404.
      if (!response.ok) {
        if (!userData) {
          toast.error("Failed to fetch user data");
        }
        return;
      }

      const data = await response.json();
      setUserData(data.user);
      setIsLive(data.user.is_live || false);
      setIsFollowing(!!data.user.is_following);
    } catch {
      // Network-level failure — also transient, never show 404.
      if (!userData) {
        toast.error("Failed to fetch user data");
      }
    }
  };

  // Re-fetch when username changes (new profile page) or when loggedInUsername
  // becomes available (async from sessionStorage) so is_following is accurate.
  useEffect(() => {
    fetchUserData(loggedInUsername);
    const interval = setInterval(() => fetchUserData(loggedInUsername), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, loggedInUsername]);

  // Handle follow
  const handleFollow = async () => {
    if (!loggedInUsername) {
      toast.error("You must be logged in to follow users.");
      setTimeout(() => {
        setShowWalletModal(true);
      }, 100);
      return;
    }

    if (isFollowing) {
      toast.info("You're already following this user.");
      return;
    }

    setFollowLoading(true);
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          receiverUsername: username,
          action: "follow",
        }),
      });

      const result = await res.json();
      if (res.ok) {
        toast.success("Followed successfully");
        // Re-fetch to get accurate follower count and UUID-based isFollowing state
        await fetchUserData();
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
        credentials: "include",
        body: JSON.stringify({
          receiverUsername: username,
          action: "unfollow",
        }),
      });

      const result = await res.json();
      if (res.ok) {
        toast.success("Unfollowed successfully");
        // Re-fetch to get accurate follower count and UUID-based isFollowing state
        await fetchUserData();
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

  // While redirecting /{username} → /{username}/watch, render nothing
  if (isDefaultRoute && isLive === true) {
    return null;
  }

  // /watch and /clips/[id] routes: render children without the profile banner/header/tabs overlay
  if (isWatchRoute || isClipRoute) {
    return (
      <div className="flex flex-col h-full bg-secondary text-foreground">
        {/* Watch: overflow-hidden so ViewStream manages its own internal scroll.
            Clips: overflow-y-auto so the page can scroll normally. */}
        <main
          className={`flex-1 min-h-0 ${isWatchRoute ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          {children}
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
            isLive={!!isLive}
            streamTitle={
              userData?.creator?.streamTitle || userData?.creator?.title
            }
            bannerUrl={userData?.banner}
          />
          <ProfileHeader
            username={username}
            followers={
              userData?.follower_count ?? userData?.followers?.length ?? 0
            }
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
            {/* Only show TipCounter when you own the profile or the creator has received at least one tip.
                Avoids showing a confusing "No tips received yet. Share your profile link…" message
                to visitors viewing someone else's page. */}
            {(isOwner || (userData?.total_tips_count ?? 0) > 0) && (
              <TipCounter
                username={username}
                variant="default"
                autoRefresh={true}
                refreshInterval={120000}
              />
            )}
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
