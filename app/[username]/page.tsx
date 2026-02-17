"use client";

import StreamCard from "@/components/shared/profile/StreamCard";

import { useState, useEffect } from "react";
import { toast } from "sonner"; // or your preferred toast lib

interface PageProps {
  params: {
    username: string;
  };
}

const ProfilePage = ({ params }: PageProps) => {
  const { username } = params;
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);

  const loggedInUsername =
    typeof window !== "undefined" ? sessionStorage.getItem("username") : null;
  console.log(loggedInUsername);
  // Fetch user data with polling for live status updates
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
          setUserExists(false);
          return;
        }

        const data = await response.json();
        setUserData(data.user);

        if (isInitialLoad) {
          console.log("Fetched user data:", data.user);
          console.log("User is_live:", data.user?.is_live);
        }
      } catch {
        if (isInitialLoad) {
          toast.error("Failed to fetch user data");
        }
        setUserExists(false);
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    };

    fetchUserData();

    // Poll every 10 seconds to update live status
    const interval = setInterval(fetchUserData, 10000);

    return () => clearInterval(interval);
  }, [username]);

  // Follow handler

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!userExists) {
    return <div>User not found</div>;
  }

  // For now, display current live stream if user is live
  const recentStreams =
    userData && userData.is_live
      ? [
          {
            id: userData.id,
            title: userData.creator?.title || `${username}'s Live Stream`,
            thumbnailUrl:
              userData.creator?.thumbnail ||
              userData.avatar ||
              "/placeholder.svg",
            username,
            category: userData.creator?.category || "Live",
            tags: userData.creator?.tags || ["live"],
            viewCount: userData.current_viewers || 0,
            isLive: true,
          },
        ]
      : [];

  // Placeholder for clips - would need a separate API endpoint for past streams/clips
  const popularClips: any[] = [];

  return (
    <>
      <section className="mb-8">
        <h2 className={`text-foreground text-xl font-medium mb-4`}>
          {userData?.is_live ? "Live Now" : "Recent Streams"}
        </h2>
        {recentStreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recentStreams.map(stream => (
              <StreamCard key={stream.id} {...stream} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>{username} is not currently streaming.</p>
            <p className="text-sm mt-2">Check back later for live streams!</p>
          </div>
        )}
      </section>

      <section>
        <h2 className={`text-foreground text-xl font-medium mb-4`}>
          Popular Clips
        </h2>
        {popularClips.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {popularClips.map(clip => (
              <StreamCard key={clip.id} {...clip} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No clips available yet.</p>
          </div>
        )}
      </section>
    </>
  );
};

export default ProfilePage;
