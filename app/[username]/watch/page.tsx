"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import { notFound } from "next/navigation";
import ViewStream from "@/components/stream/view-stream";
import { ViewStreamSkeleton } from "@/components/skeletons/ViewStreamSkeleton";
import TokenGatedAccessGate from "@/components/stream/TokenGatedAccessGate";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ username: string }>;
}

interface UserData {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  is_live: boolean;
  mux_playback_id: string | null;
  current_viewers: number;
  stream_started_at: string | null;
  creator: any;
  follower_count: number;
  is_following: boolean;
  stellar_address: string | null;
  stream_access_type?: string;
  stream_access_config?: {
    asset_code: string;
    asset_issuer: string;
    min_balance: string;
  } | null;
}

const WatchPage = ({ params }: PageProps) => {
  const { username } = use(params);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound404, setNotFound404] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  // Access control state
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);
  const [accessChecking, setAccessChecking] = useState(false);

  // Viewer tracking: one unique ID per page visit
  const viewerSessionId = useRef<string | null>(null);
  const viewerPlaybackId = useRef<string | null>(null);
  const viewerRegistered = useRef(false);

  useEffect(() => {
    setLoggedInUsername(sessionStorage.getItem("username"));
  }, []);

  const checkAccess = useCallback(async () => {
    if (!userData) return;
    // Public streams are always allowed — skip the network call
    if (
      !userData.stream_access_type ||
      userData.stream_access_type === "public"
    ) {
      setAccessAllowed(true);
      return;
    }
    setAccessChecking(true);
    try {
      const res = await fetch("/api/streams/access/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ streamerUsername: username }),
      });
      const data = await res.json();
      setAccessAllowed(data.allowed === true);
    } catch {
      // On network failure, fail open rather than lock everyone out
      setAccessAllowed(true);
    } finally {
      setAccessChecking(false);
    }
  }, [userData, username]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Poll user/stream data every 5s
  useEffect(() => {
    let isInitialLoad = true;

    const fetchUserData = async () => {
      try {
        if (isInitialLoad) {
          setLoading(true);
        }

        const viewerParam = loggedInUsername
          ? `?viewer_username=${encodeURIComponent(loggedInUsername)}&t=${Date.now()}`
          : `?t=${Date.now()}`;
        const response = await fetch(`/api/users/${username}${viewerParam}`);

        if (response.status === 404) {
          setNotFound404(true);
          return;
        }

        if (!response.ok) {
          if (isInitialLoad) {
            toast.error("Failed to load stream");
          }
          return;
        }

        const data = await response.json();
        setUserData(data.user);
        setIsFollowing(!!data.user.is_following);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        if (isInitialLoad) {
          toast.error("Failed to load stream");
        }
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    };

    fetchUserData();
    const interval = setInterval(fetchUserData, 5000);
    return () => clearInterval(interval);
  }, [username, loggedInUsername]);

  // Register viewer once when stream goes live; guard against re-registration on every poll
  useEffect(() => {
    if (!userData?.mux_playback_id || !userData?.is_live) {
      return;
    }
    if (viewerRegistered.current) {
      return;
    }

    viewerRegistered.current = true;
    const sessionId = crypto.randomUUID();
    viewerSessionId.current = sessionId;
    viewerPlaybackId.current = userData.mux_playback_id;

    fetch("/api/streams/viewers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playbackId: userData.mux_playback_id,
        sessionId,
        userId: null,
      }),
    }).catch(() => {});
  }, [userData?.mux_playback_id, userData?.is_live]);

  // Deregister viewer when leaving the page
  useEffect(() => {
    return () => {
      if (!viewerSessionId.current) {
        return;
      }
      const id = viewerSessionId.current;
      const pid = viewerPlaybackId.current;
      fetch("/api/streams/viewers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id, playbackId: pid }),
        keepalive: true,
      }).catch(() => {});
    };
  }, []);

  const handleFollow = async () => {
    if (!loggedInUsername) {
      toast.error("You must be logged in to follow users.");
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
        body: JSON.stringify({ receiverUsername: username, action: "follow" }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Followed successfully");
        setIsFollowing(true);
      } else {
        toast.error(result.error || "Failed to follow");
      }
    } catch {
      toast.error("Network error while following");
    } finally {
      setFollowLoading(false);
    }
  };

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
        setIsFollowing(false);
      } else {
        toast.error(result.error || "Failed to unfollow");
      }
    } catch {
      toast.error("Network error while unfollowing");
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return <ViewStreamSkeleton />;
  }
  if (notFound404 || !userData) {
    return notFound();
  }

  // Still waiting for access check result
  if (accessAllowed === null || (accessChecking && accessAllowed === null)) {
    return <ViewStreamSkeleton />;
  }

  // Access denied — show gate
  if (!accessAllowed && userData.stream_access_config) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-secondary">
        <div className="w-full max-w-md">
          <TokenGatedAccessGate
            streamerUsername={username}
            assetCode={userData.stream_access_config.asset_code}
            minBalance={userData.stream_access_config.min_balance}
            onRetry={checkAccess}
            isChecking={accessChecking}
          />
        </div>
      </div>
    );
  }

  const isOwner = loggedInUsername?.toLowerCase() === username.toLowerCase();

  const transformedUserData = {
    streamTitle: userData.creator?.title || `${username}'s Live Stream`,
    tags: userData.creator?.tags || [],
    viewCount: userData.current_viewers || 0,
    avatar: userData.avatar,
    bio: userData.bio || "",
    socialLinks: {
      twitter: userData.creator?.socialLinks?.twitter || "",
      instagram: userData.creator?.socialLinks?.instagram || "",
      discord: userData.creator?.socialLinks?.discord || "",
    },
    stellarAddress: userData.stellar_address || "",
    playbackId: userData.mux_playback_id,
    isLive: userData.is_live,
  };

  return (
    <ViewStream
      username={username}
      isLive={userData.is_live}
      isOwner={isOwner}
      userData={transformedUserData}
      isFollowing={isFollowing}
      followerCount={userData.follower_count ?? 0}
      onFollow={handleFollow}
      onUnfollow={handleUnfollow}
      followLoading={followLoading}
    />
  );
};

export default WatchPage;
