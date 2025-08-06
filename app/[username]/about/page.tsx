"use client";
import AboutSection from "@/components/shared/profile/AboutSection";
import { useEffect, useState } from "react";
import { toast } from "sonner";
interface PageProps {
  params: {
    username: string;
  };
}

const AboutPage = ({ params }: PageProps) => {
  const { username } = params;
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
        console.log("Fetched user data:", data.user);
        console.log("User data:", data.user?.username);
        // console.log("Logged in username:", loggedInUsername);
      } catch (error) {
        toast.error("Failed to fetch user data");
        setUserExists(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [username]);

  const currentUser = sessionStorage.getItem("username");
  // Mock function to check if current user is the owner of this profile
  const isOwner = currentUser === username;
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
        followers={userData.followers}
        bio={userData.bio}
        socialLinks={userData.socialLinks}
        isOwner={isOwner}
      />
    </>
  );
};

export default AboutPage;
