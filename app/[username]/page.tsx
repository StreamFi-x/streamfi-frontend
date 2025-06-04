"use client";
import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import OwnerChannelHome from "@/components/owner/profile/ChannelHome";
import ViewerChannelHome from "@/components/viewer/profile/ChannelHome";
import ViewStream from "@/components/stream/view-stream";

interface PageProps {
  params: {
    username: string;
  };
}

// Mock function to check if a stream is live
const checkStreamStatus = async (username: string) => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // For demo purposes, randomly determine if stream is live
  // In a real app, this would be a real API call
  return Math.random() > 0.5;
};

const ProfilePage = ({ params }: PageProps) => {
  const { username } = params;
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock function to check if user exists - would be a DB call in real app
  const userExists = true;

  // Mock function to check if current user is the owner of this profile
  const isOwner = username === "chidinma"; // Just for demo purposes

  useEffect(() => {
    const checkStatus = async () => {
      try {
        setLoading(true);
        const status = await checkStreamStatus(username);
        setIsLive(status);
      } catch (error) {
        console.error("Failed to check stream status:", error);
        setIsLive(false);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [username]);

  if (!userExists) {
    return notFound();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  // If stream is live, show the ViewStream component
  if (isLive) {
    return (
      <ViewStream
        username={username}
        isLive={true}
        onStatusChange={(status) => setIsLive(status)}
      />
    );
  }

  // Render different components based on whether the current user is the owner
  if (isOwner) {
    return <OwnerChannelHome username={username} isLive={false} />;
  }

  return <ViewerChannelHome username={username} isLive={false} />;
};

export default ProfilePage;
