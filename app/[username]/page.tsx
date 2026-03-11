"use client";

import { use, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import StreamCard from "@/components/shared/profile/StreamCard";
import { Play, Clock, Calendar } from "lucide-react";

interface PageProps {
  params: Promise<{ username: string }>;
}

interface Recording {
  id: string;
  playback_id: string;
  title: string | null;
  duration: number | null;
  created_at: string;
  stream_date: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) {
    return "";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86400000
  );
  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  if (days < 30) {
    return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  }
  if (days < 365) {
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
  }
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? "s" : ""} ago`;
}

const ProfilePage = ({ params }: PageProps) => {
  const { username } = use(params);
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [clipsLoading, setClipsLoading] = useState(true);

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

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        setClipsLoading(true);
        const res = await fetch(
          `/api/streams/recordings?username=${encodeURIComponent(username)}&limit=4`
        );
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        setRecordings(data.recordings ?? []);
      } catch {
        // silently fail — clips are supplementary on the home page
      } finally {
        setClipsLoading(false);
      }
    };

    fetchRecordings();
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

  return (
    <>
      <section className="mb-8">
        <h2 className="text-foreground text-xl font-medium mb-4">
          {userData?.is_live ? "Live Now" : "Recent Streams"}
        </h2>
        {recentStreams.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground text-xl font-medium">Past Streams</h2>
          {recordings.length > 0 && (
            <button
              onClick={() => router.push(`/${username}/clips`)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </button>
          )}
        </div>

        {clipsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recordings.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recordings.map(rec => {
              const previewStart = rec.duration
                ? rec.duration > 1200
                  ? 1200
                  : Math.max(5, Math.floor(rec.duration * 0.1))
                : 60;
              const thumb = rec.playback_id
                ? `https://image.mux.com/${rec.playback_id}/thumbnail.jpg?width=640&time=${previewStart}`
                : null;
              const title =
                rec.title ??
                `Stream — ${timeAgo(rec.stream_date ?? rec.created_at)}`;

              return (
                <button
                  key={rec.id}
                  onClick={() => router.push(`/${username}/clips/${rec.id}`)}
                  className="group text-left rounded-lg overflow-hidden bg-card border border-border hover:border-purple-500/50 transition-colors w-full"
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-muted flex items-center justify-center">
                        <Play className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    {rec.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                        {formatDuration(rec.duration)}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-foreground text-sm font-medium line-clamp-2 mb-2">
                      {title}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {rec.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(rec.duration)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {timeAgo(rec.stream_date ?? rec.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No past streams yet.</p>
          </div>
        )}
      </section>
    </>
  );
};

export default ProfilePage;
