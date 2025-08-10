"use client";

import StreamCard from "@/components/shared/profile/StreamCard";
import { textClasses } from "@/lib/theme-classes";
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

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!userExists) {
    return <div>User not found</div>;
  }

  // Mock data for streams
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

  return (
    <>
      <section className="mb-8">
        <h2 className={`${textClasses.primary} text-xl font-medium mb-4`}>
          Recent Streams
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {recentStreams.map((stream) => (
            <StreamCard key={stream.id} {...stream} />
          ))}
        </div>
      </section>

      <section>
        <h2 className={`${textClasses.primary} text-xl font-medium mb-4`}>
          Popular Clips
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {popularClips.map((clip) => (
            <StreamCard key={clip.id} {...clip} />
          ))}
        </div>
      </section>
    </>
  );
};

export default ProfilePage;
