"use client";

import { use, useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clock, Calendar, Users } from "lucide-react";
import MuxPlayer from "@/components/MuxPlayerLazy";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ username: string; id: string }>;
}

interface Recording {
  id: string;
  playback_id: string;
  title: string | null;
  duration: number | null;
  created_at: string;
  stream_date: string | null;
  username: string;
  avatar: string | null;
  bio: string | null;
}

interface UserData {
  follower_count: number;
  is_following: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) {return "";}
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;}
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {return "Today";}
  if (days === 1) {return "Yesterday";}
  if (days < 7) {return `${days} days ago`;}
  if (days < 30) {return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;}
  if (days < 365) {return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;}
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? "s" : ""} ago`;
}

const ClipPlayerPage = ({ params }: PageProps) => {
  const { username, id } = use(params);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound404, setNotFound404] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  useEffect(() => {
    setLoggedInUsername(sessionStorage.getItem("username"));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const viewerParam = loggedInUsername
          ? `?viewer_username=${encodeURIComponent(loggedInUsername)}`
          : "";

        const [recRes, userRes] = await Promise.all([
          fetch(`/api/streams/recordings/${id}`),
          fetch(`/api/users/${username}${viewerParam}`),
        ]);

        if (recRes.status === 404) {
          setNotFound404(true);
          return;
        }
        if (!recRes.ok) {throw new Error("Failed to fetch recording");}

        const recData = await recRes.json();
        setRecording(recData.recording);

        if (userRes.ok) {
          const ud = await userRes.json();
          setUserData(ud.user);
          setIsFollowing(!!ud.user.is_following);
        }
      } catch {
        setNotFound404(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, username, loggedInUsername]);

  const handleFollow = async () => {
    if (!loggedInUsername) {
      toast.error("You must be logged in to follow users.");
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
      toast.error("You must be logged in to unfollow.");
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

  if (notFound404) {return notFound();}

  const isOwner = loggedInUsername?.toLowerCase() === username.toLowerCase();
  const title = recording
    ? recording.title ?? `Stream — ${timeAgo(recording.stream_date ?? recording.created_at)}`
    : "";

  return (
    <div className="flex flex-col min-h-screen bg-[#17191A] text-foreground">
      {/* Back navigation */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href={`/${username}/clips`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Past Streams
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col">
          <div className="aspect-video bg-black animate-pulse" />
          <div className="p-4 space-y-3">
            <div className="h-5 bg-muted rounded w-2/3 animate-pulse" />
            <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
          </div>
        </div>
      ) : recording ? (
        <>
          {/* Full-width player */}
          <div className="w-full bg-black aspect-video">
            <MuxPlayer
              playbackId={recording.playback_id}
              streamType="on-demand"
              autoPlay
              metadata={{
                video_id: recording.playback_id,
                video_title: title,
                viewer_user_id: "anonymous",
              }}
              primaryColor="#ac39f2"
              className="w-full h-full"
            />
          </div>

          {/* Stream info bar */}
          <div className="border-b border-border p-4">
            <h1 className="text-foreground font-semibold text-lg mb-3">{title}</h1>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-purple-600 flex-shrink-0">
                  {recording.avatar ? (
                    <Image
                      src={recording.avatar}
                      alt={username}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                      {username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-foreground font-medium">{username}</p>
                  <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {(userData?.follower_count ?? 0).toLocaleString()} followers
                    </span>
                    {recording.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(recording.duration)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {timeAgo(recording.stream_date ?? recording.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {!isOwner && (
                <Button
                  className={
                    isFollowing
                      ? "bg-gray-700 hover:bg-gray-600 text-white border-none flex-shrink-0"
                      : "bg-purple-600 hover:bg-purple-700 text-white border-none flex-shrink-0"
                  }
                  onClick={isFollowing ? handleUnfollow : handleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? "…" : isFollowing ? "Unfollow" : "Follow"}
                </Button>
              )}
            </div>
          </div>

          {/* About section */}
          {recording.bio && (
            <div className="p-4">
              <h3 className="text-foreground font-medium mb-2">About {username}</h3>
              <p className="text-muted-foreground text-sm">{recording.bio}</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default ClipPlayerPage;
