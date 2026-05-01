"use client";

import { use, useEffect, useState, useRef } from "react";
import { notFound, useSearchParams } from "next/navigation";
import ViewStream from "@/components/stream/view-stream";
import { ViewStreamSkeleton } from "@/components/skeletons/ViewStreamSkeleton";
import { toast } from "sonner";
import PrivateStreamGate from "@/components/stream/private-stream-gate";

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
  latency_mode: string | null;
  stream_privacy: string | null;
}

interface AccessInfo {
  allowed: boolean;
  reason: string | null;
}

const WatchPage = ({ params }: PageProps) => {
  const { username } = use(params);
  const searchParams = useSearchParams();
  const shareKey = searchParams?.get("key") ?? null;
  const [userData, setUserData] = useState<UserData | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound404, setNotFound404] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  // Viewer tracking: one unique ID per page visit
  const viewerSessionId = useRef<string | null>(null);
  const viewerPlaybackId = useRef<string | null>(null);
  const viewerRegistered = useRef(false);

  useEffect(() => {
    setLoggedInUsername(sessionStorage.getItem("username"));
  }, []);

  // Poll user/stream data every 5s
  useEffect(() => {
    let isInitialLoad = true;

    const fetchUserData = async () => {
      try {
        if (isInitialLoad) {
          setLoading(true);
        }

        const qs = new URLSearchParams();
        if (loggedInUsername) {
          qs.set("viewer_username", loggedInUsername);
        }
        if (shareKey) {
          qs.set("key", shareKey);
        }
        qs.set("t", String(Date.now()));
        const response = await fetch(`/api/users/${username}?${qs.toString()}`);

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
        setAccess(data.access ?? { allowed: true, reason: null });
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
  }, [username, loggedInUsername, shareKey]);

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

  const isOwner = loggedInUsername?.toLowerCase() === username.toLowerCase();

  // Private stream + viewer not authorized: show gate instead of player
  if (access && !access.allowed && !isOwner) {
    return (
      <PrivateStreamGate
        username={username}
        privacy={(userData.stream_privacy as any) || "unlisted"}
        reason={access.reason}
        avatar={userData.avatar}
      />
    );
  }

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
    latencyMode: userData.latency_mode || "low",
    isLive: userData.is_live,
    privacy: userData.stream_privacy || "public",
    shareKey: shareKey,
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
