"use client";

import { use, useEffect, useState, useRef } from "react";
import { notFound } from "next/navigation";
import ViewStream from "@/components/stream/view-stream";
import { ViewStreamSkeleton } from "@/components/skeletons/ViewStreamSkeleton";
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
}

const WatchPage = ({ params }: PageProps) => {
  const { username } = use(params);
  const [userData, setUserData] = useState<UserData | null>(null);
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
        if (isInitialLoad) setLoading(true);

        const viewerParam = loggedInUsername
          ? `?viewer_username=${encodeURIComponent(loggedInUsername)}&t=${Date.now()}`
          : `?t=${Date.now()}`;
        const response = await fetch(`/api/users/${username}${viewerParam}`);

        if (response.status === 404) {
          setNotFound404(true);
          return;
        }

        if (!response.ok) {
          if (isInitialLoad) toast.error("Failed to load stream");
          return;
        }

        const data = await response.json();
        setUserData(data.user);
        setIsFollowing(!!data.user.is_following);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        if (isInitialLoad) toast.error("Failed to load stream");
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
    if (!userData?.mux_playback_id || !userData?.is_live) return;
    if (viewerRegistered.current) return;

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
      if (!viewerSessionId.current) return;
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
        body: JSON.stringify({ receiverUsername: username, action: "unfollow" }),
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

  if (loading) return <ViewStreamSkeleton />;
  if (notFound404 || !userData) return notFound();

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
