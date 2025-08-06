import Banner from "@/components/shared/profile/Banner";
import ProfileHeader from "@/components/shared/profile/ProfileHeader";
import TabsNavigation from "@/components/shared/profile/TabsNavigation";
import AboutSection from "@/components/shared/profile/AboutSection";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ChannelAboutProps {
  username: string;
  isLive: boolean;
  streamTitle?: string;
}

const OwnerAbout = ({ username, isLive, streamTitle }: ChannelAboutProps) => {
  // const { username } = params;
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
      {/* <Banner username={username} isLive={isLive} streamTitle={streamTitle} />
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
      <TabsNavigation username={username} /> */}

      <div className="p-6">
        <AboutSection
          username={userData.username}
          followers={userData.followers}
          bio={userData.bio}
          socialLinks={userData.socialLinks}
          isOwner={false}
        />
      </div>
    </div>
  );
};

export default OwnerAbout;
