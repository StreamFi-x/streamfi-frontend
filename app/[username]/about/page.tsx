"use client";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import AboutSection from "@/components/shared/profile/AboutSection";

interface PageProps {
  params: Promise<{ username: string }>;
}

const AboutPage = ({ params }: PageProps) => {
  const { username } = use(params);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);

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
      } catch {
        toast.error("Failed to fetch user data");
        setUserExists(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [username]);

  const isOwner =
    typeof window !== "undefined" &&
    sessionStorage.getItem("username") === username;
  if (loading) {
    return <div>Loading...</div>;
  }
  if (!userExists) {
    return <div>User not found</div>;
  }

  return (
    <>
      <AboutSection
        username={userData.username}
        followers={null}
        followerCount={userData.follower_count ?? 0}
        bio={userData.bio}
        socialLinks={userData.socialLinks}
        isOwner={isOwner}
      />
    </>
  );
};

export default AboutPage;
