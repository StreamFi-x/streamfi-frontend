"use client";

import { use, useState, useEffect } from "react";
import { toast } from "sonner";
import StreamCard from "@/components/shared/profile/StreamCard";

interface PageProps {
  params: Promise<{ username: string }>;
}

const ProfilePage = ({ params }: PageProps) => {
  const { username } = use(params);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);

  useEffect(() => {
    let isInitialLoad = true;

    const fetchUserData = async () => {
      try {
        if (isInitialLoad) {
          setLoading(true);
        }

        const response = await fetch(`/api/users/${username}?t=${Date.now()}`);

        // Only mark as not-found for an explicit 404 — not for server errors or
        // network timeouts, which are transient and should not show "User not found".
        if (response.status === 404) {
          setUserExists(false);
          return;
        }

        if (!response.ok) {
          // Server error (500, timeout, etc.) — keep showing existing data if we
          // have it, or show a toast on the initial load. Don't set userExists=false.
          if (isInitialLoad) {
            toast.error("Failed to load profile. Retrying…");
          }
          return;
        }

        const data = await response.json();
        setUserData(data.user);
      } catch {
        // Network failure — same as above, transient, don't show "User not found".
        if (isInitialLoad) {
          toast.error("Failed to load profile. Retrying…");
        }
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    };

    fetchUserData();
    // Poll every 30s instead of 10s — profile data doesn't change that frequently.
    const interval = setInterval(fetchUserData, 30000);
    return () => clearInterval(interval);
  }, [username]);

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!userExists) {
    return <div>User not found</div>;
  }

  const recentStreams = userData?.is_live
    ? [
        {
          id: userData.id,
          title: userData.creator?.title || `${username}'s Live Stream`,
          thumbnailUrl:
            userData.creator?.thumbnail ||
            userData.avatar ||
            "/Images/user.png",
          username,
          category: userData.creator?.category || "Live",
          tags: userData.creator?.tags || ["live"],
          viewCount: userData.current_viewers || 0,
          isLive: true,
        },
      ]
    : [];

  const popularClips: any[] = [];

  return (
    <>
      <section className="mb-8">
        <h2 className="text-foreground text-xl font-medium mb-4">
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
        <h2 className="text-foreground text-xl font-medium mb-4">
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
