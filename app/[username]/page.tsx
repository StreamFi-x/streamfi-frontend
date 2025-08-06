"use client";
import StreamCard from "@/components/shared/profile/stream-card";
import { textClasses } from "@/lib/theme-classes";

interface PageProps {
  params: {
    username: string;
  };
}

const ProfilePage = ({ params }: PageProps) => {
  const { username } = params;

  // Mock data for streams
  const recentStreams = [
    {
      id: "1",
      title: "Clash of clans Live play",
      thumbnailUrl: "/images/explore/home/live-stream/img1.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
    {
      id: "2",
      title: "Clash of clans Live play",
      thumbnailUrl: "/images/explore/home/live-stream/img2.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
    {
      id: "3",
      title: "Clash of clans Live play",
      thumbnailUrl: "/images/explore/home/live-stream/img3.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
    {
      id: "4",
      title: "Clash of clans Live play",
      thumbnailUrl: "/images/explore/home/live-stream/img4.png",
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
      thumbnailUrl: "/images/explore/home/live-stream/img4.png",
      username,
      category: "Flexgames",
      tags: ["Nigerian", "Gameplay"],
      viewCount: 14500,
      isLive: true,
    },
    {
      id: "6",
      title: "Epic win",
      thumbnailUrl: "/images/explore/home/live-stream/img3.png",
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentStreams.map((stream) => (
            <StreamCard key={stream.id} {...stream} />
          ))}
        </div>
      </section>

      <section>
        <h2 className={`${textClasses.primary} text-xl font-medium mb-4`}>
          Popular Clips
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popularClips.map((clip) => (
            <StreamCard key={clip.id} {...clip} />
          ))}
        </div>
      </section>
    </>
  );
};

export default ProfilePage;
