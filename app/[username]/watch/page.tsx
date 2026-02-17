"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import ViewStream from "@/components/stream/view-stream";
import { ViewStreamSkeleton } from "@/components/skeletons/ViewStreamSkeleton";
import { toast } from "sonner";

interface PageProps {
  params: {
    username: string;
  };
}

interface UserData {
  id: string;
  username: string;
  wallet_address: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  is_live: boolean;
  mux_playback_id: string | null;
  mux_stream_id: string | null;
  mux_stream_key: string | null;
  current_viewers: number;
  total_views: number;
  stream_started_at: string | null;
  creator: any;
  followers: string[];
  following: string[];
  starknet_address: string | null;
}

const WatchPage = ({ params }: PageProps) => {
  const { username } = params;
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound404, setNotFound404] = useState(false);

  useEffect(() => {
    let isInitialLoad = true;

    const fetchUserData = async () => {
      try {
        if (isInitialLoad) {
          setLoading(true);
        }

        // Add timestamp to prevent caching
        const response = await fetch(`/api/users/${username}?t=${Date.now()}`);

        if (response.status === 404) {
          setNotFound404(true);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }

        const data = await response.json();
        setUserData(data.user);
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

    // Poll every 5 seconds to update live status
    const interval = setInterval(fetchUserData, 5000);

    return () => clearInterval(interval);
  }, [username]);

  if (loading) {
    return <ViewStreamSkeleton />;
  }

  if (notFound404 || !userData) {
    return notFound();
  }

  // Transform userData for ViewStream component
  const transformedUserData = {
    streamTitle: userData.creator?.title || `${username}'s Live Stream`,
    tags: userData.creator?.tags || [],
    viewCount: userData.current_viewers || 0,
    avatar: userData.avatar,
    bio: userData.bio || "",
    followers: userData.followers || [],
    socialLinks: {
      twitter: userData.creator?.socialLinks?.twitter || "",
      instagram: userData.creator?.socialLinks?.instagram || "",
      discord: userData.creator?.socialLinks?.discord || "",
    },
    starknetAddress: userData.starknet_address || "",
    playbackId: userData.mux_playback_id,
    isLive: userData.is_live,
  };

  return (
    <ViewStream
      username={username}
      isLive={userData.is_live}
      userData={transformedUserData}
    />
  );
};

export default WatchPage;
