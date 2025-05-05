"use client";
import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Banner from "@/components/shared/profile/Banner";
import ProfileHeader from "@/components/shared/profile/ProfileHeader";
import TabsNavigation from "@/components/shared/profile/TabsNavigation";
import AboutSection from "@/components/shared/profile/AboutSection";

interface PageProps {
  params: {
    username: string;
  };
}

// Mock function to fetch user data
const fetchUserData = async (username: string) => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // For demo purposes, sometimes return a user with no bio
  const hasBio = Math.random() > 0.5;

  return {
    username,
    followers: 2000,
    avatarUrl: "/placeholder.svg?height=64&width=64",
    bio: hasBio
      ? "Chidinma Cassandra is a seasoned product designer that has been designing digital products and creating seamless experiences for users interacting with blockchain and web 3 products."
      : "",
    socialLinks: {
      twitter: "https://twitter.com/kassinma",
      instagram: "https://instagram.com/kass_dinma",
      discord: "https://discord.gg/kassinma",
    },
  };
};

const AboutPage = ({ params }: PageProps) => {
  const { username } = params;
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Mock function to check if user exists - would be a DB call in real app
  const userExists = true;

  // Mock function to check if current user is the owner of this profile
  const isOwner = username === "chidinma"; // Just for demo purposes

  // Mock function to check if streamer is live
  const isLive = false;
  const streamTitle = isLive ? "co-working and designing" : undefined;

  useEffect(() => {
    const getUserData = async () => {
      try {
        setLoading(true);
        const data = await fetchUserData(username);
        setUserData(data);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setLoading(false);
      }
    };

    getUserData();
  }, [username]);

  if (!userExists) {
    return notFound();
  }

  if (loading || !userData) {
    return (
      <div className="bg-[#17191A] min-h-screen">
        <div className="flex justify-center py-12">
          <p className="text-gray-400">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#17191A] min-h-screen">
      <Banner username={username} isLive={isLive} streamTitle={streamTitle} />
      <ProfileHeader
        username={userData.username}
        followers={userData.followers}
        avatarUrl={userData.avatarUrl}
        isOwner={isOwner}
      />
      <TabsNavigation username={username} />

      <div className="p-6">
        <AboutSection
          username={userData.username}
          followers={userData.followers}
          bio={userData.bio}
          socialLinks={userData.socialLinks}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
};

export default AboutPage;
