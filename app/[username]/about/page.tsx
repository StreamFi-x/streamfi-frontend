"use client";
import AboutSection from "@/components/shared/profile/about-section";

interface PageProps {
  params: {
    username: string;
  };
}

const AboutPage = ({ params }: PageProps) => {
  const { username } = params;

  // Mock function to check if current user is the owner of this profile
  const isOwner = username === "chidinma"; // Just for demo purposes

  // Mock user data - in a real app, this would come from the layout or be fetched here
  const userData = {
    username,
    followers: 2000,
    bio: "Chidinma Cassandra is a seasoned product designer that has been designing digital products and creating seamless experiences for users interacting with blockchain and web 3 products.",
    socialLinks: {
      twitter: "https://twitter.com/kassinma",
      instagram: "https://instagram.com/kass_dinma",
      discord: "https://discord.gg/kassinma",
    },
  };

  return (
    <AboutSection
      username={userData.username}
      followers={userData.followers}
      bio={userData.bio}
      socialLinks={userData.socialLinks}
      isOwner={isOwner}
    />
  );
};

export default AboutPage;
