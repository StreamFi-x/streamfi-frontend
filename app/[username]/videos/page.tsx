"use client";
import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import StreamCard from "@/components/shared/profile/StreamCard";
import EmptyState from "@/components/shared/profile/EmptyState";
import { bgClasses, textClasses, combineClasses } from "@/lib/theme-classes";

interface PageProps {
  params: {
    username: string;
  };
}

// Mock function to fetch videos
const fetchVideos = async (username: string) => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // For demo purposes, return empty array to show empty state
  return [];
};

const VideosPage = ({ params }: PageProps) => {
  const { username } = params;
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock function to check if user exists - would be a DB call in real app
  const userExists = true;

  // Mock function to check if current user is the owner of this profile
  const isOwner = username === "chidinma"; // Just for demo purposes

  useEffect(() => {
    const getVideos = async () => {
      try {
        setLoading(true);
        const data = await fetchVideos(username);
        setVideos(data);
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      } finally {
        setLoading(false);
      }
    };

    getVideos();
  }, [username]);

  if (!userExists) {
    return notFound();
  }

  return (
    <div className={combineClasses(bgClasses.secondary, "min-h-screen")}>
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <p className={textClasses.tertiary}>Loading videos...</p>
          </div>
        ) : videos.length > 0 ? (
          <section>
            <h2 className={`${textClasses.primary} text-xl font-medium mb-4`}>
              Videos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {videos.map((video) => (
                <StreamCard key={video.id} {...video} />
              ))}
            </div>
          </section>
        ) : (
          <EmptyState type="videos" isOwner={isOwner} username={username} />
        )}
      </div>
    </div>
  );
};

export default VideosPage;
