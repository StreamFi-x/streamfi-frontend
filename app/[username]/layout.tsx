"use client";

import { useState, useEffect } from "react";
import { notFound, usePathname } from "next/navigation";
import { toast } from "sonner";

import Banner from "@/components/shared/profile/Banner";
import ProfileHeader from "@/components/shared/profile/ProfileHeader";
import TabsNavigation from "@/components/shared/profile/TabsNavigation";
import ViewStream from "@/components/stream/view-stream";
import { bgClasses, textClasses, combineClasses } from "@/lib/theme-classes";

export default function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { username: string };
}) {
  const { username } = params;
  const pathname = usePathname();

  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const loggedInUsername =
    typeof window !== "undefined" ? sessionStorage.getItem("username") : null;

  const isDefaultRoute = pathname === `/${username}`;
  const isOwner = loggedInUsername === username;

  // Fetch user data and following state
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${username}`);
        if (response.status === 404) {
          setUserExists(false);
          return;
        }

        const data = await response.json();
        setUserData(data.user);

        if (
          typeof window !== "undefined" &&
          sessionStorage.getItem("username")
        ) {
          const loggedInUser = sessionStorage.getItem("username");
          setIsFollowing(data.user.followers?.includes(loggedInUser));
        }
      } catch (error) {
        toast.error("Failed to fetch user data");
        setUserExists(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [username]);

  // Handle follow
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
    } catch (error) {
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
    } catch (error) {
      toast.error("Network error while unfollowing");
    } finally {
      setFollowLoading(false);
    }
  };

  if (!userExists) return notFound();

  if (isDefaultRoute && isLive) {
    return (
      <div
        className={combineClasses(
          "flex flex-col h-screen",
          bgClasses.secondary,
          textClasses.primary
        )}
      >
        <main className="flex-1 overflow-auto">
          <ViewStream
            username={username}
            isLive={true}
            onStatusChange={(status) => setIsLive(status)}
            isOwner={isOwner}
          />
        </main>
      </div>
    );
  }

  return (
    <div
      className={combineClasses(
        "flex flex-col h-screen",
        bgClasses.secondary,
        textClasses.primary
      )}
    >
      <main className="flex-1 overflow-auto">
        <div className={combineClasses(bgClasses.secondary, "min-h-screen")}>
          <Banner
            username={username}
            isLive={isDefaultRoute && !!isLive}
            streamTitle={undefined}
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
          />
          <TabsNavigation username={username} />
          <div className="p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
