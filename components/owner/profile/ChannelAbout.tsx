import Banner from "@/components/shared/profile/Banner"
import ProfileHeader from "@/components/shared/profile/ProfileHeader"
import TabsNavigation from "@/components/shared/profile/TabsNavigation"
import AboutSection from "@/components/shared/profile/AboutSection"

interface ChannelAboutProps {
  username: string
  isLive: boolean
  streamTitle?: string
}

const ChannelAbout = ({ username, isLive, streamTitle }: ChannelAboutProps) => {
  // Mock data - would be fetched from API in a real implementation
  const userData = {
    username,
    followers: 2000,
    avatarUrl: "/placeholder.svg?height=64&width=64",
    bio: "Chidinma Cassandra is a seasoned product designer that has been designing didigtal products and creating seamless experiences for users intercating with blockchain and web 3 products. Chidinma Cassandra is a seasoned product designer that has been designing didigtal products and creating seamless experiences for users intercating with blockchain and web 3 products",
    socialLinks: {
      twitter: "https://twitter.com/kassinma",
      instagram: "https://instagram.com/kass_dinma",
      discord: "https://discord.gg/kassinma",
    },
  }

  return (
    <div className="bg-gray-950 min-h-screen">
      <Banner username={username} isLive={isLive} streamTitle={streamTitle} />
      <ProfileHeader
        username={userData.username}
        followers={userData.followers}
        avatarUrl={userData.avatarUrl}
        isOwner={true}
      />
      <TabsNavigation username={username} />

      <div className="p-6">
        <AboutSection
          username={userData.username}
          followers={userData.followers}
          bio={userData.bio}
          socialLinks={userData.socialLinks} isOwner={false}        />
      </div>
    </div>
  )
}

export default ChannelAbout
