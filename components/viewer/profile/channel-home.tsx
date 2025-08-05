import Banner from "@/components/shared/profile/banner";
import ProfileHeader from "@/components/shared/profile/profile-header";
import TabsNavigation from "@/components/shared/profile/tabs-navigation";
import StreamCard from "@/components/shared/profile/stream-card";

interface ChannelHomeProps {
  username: string;
  isLive: boolean;
  streamTitle?: string;
  avatarUrl?: string;
}

const ChannelHome = ({
  username,
  isLive,
  streamTitle,
  avatarUrl,
}: ChannelHomeProps) => {
  // Mock data - would be fetched from API in a real implementation
  const userData = {
    username,
    followers: 2000,
    avatarUrl: avatarUrl || "/images/user.png",
  };

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
    <div className="bg-gray-950 min-h-screen">
      <Banner username={username} isLive={isLive} streamTitle={streamTitle} />
      <ProfileHeader
        username={userData.username}
        followers={userData.followers}
        avatarUrl={userData.avatarUrl}
        isOwner={false}
      />
      <TabsNavigation username={username} />

      <div className="p-6">
        <section className="mb-8">
          <h2 className="text-white text-xl font-medium mb-4">
            Recent Streams
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentStreams.map((stream) => (
              <StreamCard key={stream.id} {...stream} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-white text-xl font-medium mb-4">Popular Clips</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularClips.map((clip) => (
              <StreamCard key={clip.id} {...clip} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChannelHome;
