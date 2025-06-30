"use client";
import { useState, useEffect } from "react";
import type React from "react";
import { notFound, usePathname } from "next/navigation";
import Sidebar from "@/components/explore/Sidebar";
import Navbar from "@/components/explore/Navbar";
import Banner from "@/components/shared/profile/Banner";
import ProfileHeader from "@/components/shared/profile/ProfileHeader";
import TabsNavigation from "@/components/shared/profile/TabsNavigation";
import ViewStream from "@/components/stream/view-stream";
import { bgClasses, textClasses, combineClasses } from "@/lib/theme-classes";

// Mock data for sidebar props
const sidebarProps = {
  isOpen: true,
  onClose: () => {},
};

// Mock function to check if a stream is live
const checkStreamStatus = async (username: string) => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // For demo purposes, randomly determine if stream is live
  // In a real app, this would be a real API call
  return Math.random() > 0.7; // Lower chance of being live for testing
};

// Mock function to fetch user data
const fetchUserData = async (username: string) => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  // const response = await fetch(`/api/search-username/${username}`, {
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   method: "GET",
  // });

  // if (!response.ok) {
  //   throw new Error("User not found");
  // }

  // Mock user data - would be fetched from API in a real implementation
  return {
    username,
    followers: 2000,
    avatarUrl: "/Images/user.png",
    bio: "Chidinma Cassandra is a seasoned product designer that has been designing digital products and creating seamless experiences for users interacting with blockchain and web 3 products.",
    socialLinks: {
      twitter: "https://twitter.com/kassinma",
      instagram: "https://instagram.com/kass_dinma",
      discord: "https://discord.gg/kassinma",
    },
  };
};

export default function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { username: string };
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);

  const { username } = params;
  const pathname = usePathname();

  // Check if we're on the default route (just /[username])
  const isDefaultRoute = pathname === `/${username}`;

  // Mock function to check if current user is the owner of this profile
  const isOwner = username === "chidinma"; // Just for demo purposes

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    const initializeProfile = async () => {
      try {
        setLoading(true);

        // Check if user exists (in a real app, this would be an API call)
        // For demo purposes, assume user exists unless username is "nonexistent"
        if (username === "nonexistent") {
          setUserExists(false);
          return;
        }

        // Always fetch user data
        const userData = await fetchUserData(username);
        setUserData(userData);

        // Only check stream status if we're on the default route
        if (isDefaultRoute) {
          const streamStatus = await checkStreamStatus(username);
          setIsLive(streamStatus);
        } else {
          setIsLive(false); // Always false for non-default routes
        }
      } catch (error) {
        console.error("Failed to initialize profile:", error);
        setUserExists(false);
      } finally {
        setLoading(false);
      }
    };

    initializeProfile();
  }, [username, isDefaultRoute]);

  if (!userExists) {
    return notFound();
  }

  // if (loading) {
  //   return (
  //     <div className={combineClasses("flex h-screen", bgClasses.secondary, textClasses.primary)}>
  //       <Sidebar {...sidebarProps} />
  //       <div className="flex-1 flex flex-col overflow-hidden">
  //         <Navbar toggleSidebar={toggleSidebar} />
  //         <main className="flex-1 overflow-auto flex items-center justify-center">
  //           <p className={textClasses.primary}>Loading...</p>
  //         </main>
  //       </div>
  //     </div>
  //   );
  // }

  // Only show live stream if we're on the default route AND the stream is live
  if (isDefaultRoute && isLive) {
    return (
      <div
        className={combineClasses(
          "flex flex-col h-screen",
          bgClasses.secondary,
          textClasses.primary
        )}
      >
        <Navbar toggleSidebar={toggleSidebar} />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <ViewStream
              username={username}
              isLive={true}
              onStatusChange={(status) => setIsLive(status)}
              isOwner={isOwner}
            />
          </main>
        </div>
      </div>
    );
  }

  // Default layout with Banner, ProfileHeader, and TabsNavigation for all other cases
  return (
    <div
      className={combineClasses(
        "flex flex-col h-screen",
        bgClasses.secondary,
        textClasses.primary
      )}
    >
      <Navbar toggleSidebar={toggleSidebar} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className={combineClasses(bgClasses.secondary, "min-h-screen")}>
            <Banner
              username={username}
              isLive={isDefaultRoute && !!isLive}
              streamTitle={undefined}
            />
            <ProfileHeader
              username={userData?.username || username}
              followers={userData?.followers || 0}
              avatarUrl={userData?.avatarUrl || "/Images/user.png"}
              isOwner={isOwner}
            />
            <TabsNavigation username={username} />

            {/* Page-specific content */}
            <div className="p-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
