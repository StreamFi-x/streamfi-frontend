import Banner from "@/components/shared/profile/Banner";
import ProfileHeader from "@/components/shared/profile/ProfileHeader";
import TabsNavigation from "@/components/shared/profile/TabsNavigation";
import StreamCard from "@/components/shared/profile/StreamCard";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ChannelHomeProps {
  username: string;
  isLive: boolean;
  streamTitle?: string;
  avatarUrl?: string;
}

const ChannelHome = ({
  username,
  isLive,
  streamTitle,
  avatarUrl,
}: ChannelHomeProps) => {
  // Mock data - would be fetched from API in a real implementation
  // const userData = {
  //   username,
  //   followers: 2000,
  //   avatarUrl: avatarUrl || "/Images/user.png",
  // };

  const recentStreams = [
    {
      id: "1",
      title: "Clash of clans Live play",
      thumbnailUrl: "/Images/explore/home/live-stream/img1.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
    {
      id: "2",
      title: "Clash of clans Live play",
      thumbnailUrl: "/Images/explore/home/live-stream/img2.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
    {
      id: "3",
      title: "Clash of clans Live play",
      thumbnailUrl: "/Images/explore/home/live-stream/img3.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
    {
      id: "4",
      title: "Clash of clans Live play",
      thumbnailUrl: "/Images/explore/home/live-stream/img4.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
  ];

  const popularClips = [
    {
      id: "5",
      title: "Amazing headshot",
      thumbnailUrl: "/Images/explore/home/live-stream/img4.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
    {
      id: "6",
      title: "Epic win",
      thumbnailUrl: "/Images/explore/home/live-stream/img3.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
  ];
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const loggedInUsername =
    typeof window !== "undefined" ? sessionStorage.getItem("username") : null;
  console.log(loggedInUsername);
  // Fetch user data
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
        console.log("Fetched user data:", data.user);
        console.log("User data:", data.user?.username);
        console.log("Logged in username:", loggedInUsername);
      } catch (error) {
        toast.error("Failed to fetch user data");
        setUserExists(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [username, loggedInUsername]);

  // Follow handler
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-gray-950 min-h-screen">
      <Banner username={username} isLive={isLive} streamTitle={streamTitle} />
      <ProfileHeader
        username={userData.username}
        followers={userData.followers}
        avatarUrl={userData.avatarUrl}
        isOwner={true}
        isFollowing={isFollowing}
        onFollow={handleFollow}
        onUnfollow={handleUnfollow}
        followLoading={followLoading}
      />
      <TabsNavigation username={username} />

      <div className="p-6">
        <section className="mb-8">
          <h2 className="text-white text-xl font-medium mb-4">
            Recent Streams
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentStreams.map(stream => (
              <StreamCard key={stream.id} {...stream} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-white text-xl font-medium mb-4">Popular Clips</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularClips.map(clip => (
              <StreamCard key={clip.id} {...clip} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChannelHome;
