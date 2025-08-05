"use client";
import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import EmptyState from "@/components/shared/profile/empty-state";
import { bgClasses, textClasses, combineClasses } from "@/lib/theme-classes";

interface PageProps {
  params: {
    username: string;
  };
}

// Mock function to fetch clips
const fetchClips = async (username: string) => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // For demo purposes, return empty array to show empty state
  return [];
};

const ClipsPage = ({ params }: PageProps) => {
  const { username } = params;
  const [clips, setClips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock function to check if user exists - would be a DB call in real app
  const userExists = true;

  // Mock function to check if current user is the owner of this profile
  const isOwner = username === "chidinma"; // Just for demo purposes

  useEffect(() => {
    const getClips = async () => {
      try {
        setLoading(true);
        const data = await fetchClips(username);
        setClips(data);
      } catch (error) {
        console.error("Failed to fetch clips:", error);
      } finally {
        setLoading(false);
      }
    };

    getClips();
  }, [username]);

  if (!userExists) {
    return notFound();
  }

  return (
    <div className={combineClasses(bgClasses.secondary, "min-h-screen")}>
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <p className={textClasses.tertiary}>Loading clips...</p>
          </div>
        ) : clips.length > 0 ? (
          <section>
            <h2 className={`${textClasses.primary} text-xl font-medium mb-4`}>
              Clips
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Clips would be rendered here */}
            </div>
          </section>
        ) : (
          <EmptyState type="clips" isOwner={isOwner} username={username} />
        )}
      </div>
    </div>
  );
};

export default ClipsPage;
