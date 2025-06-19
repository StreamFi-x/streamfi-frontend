import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import CustomizeChannelButton from "./CustomizeChannelButton"
import { textClasses, buttonClasses, combineClasses } from "@/lib/theme-classes"

interface ProfileHeaderProps {
  username: string
  followers: number
  avatarUrl: string
  isOwner: boolean
}

const ProfileHeader = ({ username, followers, avatarUrl, isOwner }: ProfileHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-purple-600 mr-4">
          <Image src={avatarUrl || "/Images/user.png"} alt={username} fill className="object-cover" />
        </div>
        <div>
          <h1 className={combineClasses(textClasses.primary, "text-xl font-bold")}>{username}</h1>
          <p className={combineClasses(textClasses.tertiary, "text-sm")}>{followers.toLocaleString()} followers</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {isOwner ? (
          <CustomizeChannelButton />
        ) : (
          <>
            <Button className={combineClasses(buttonClasses.secondary, textClasses.onColor, "border-none")}>
              Follow
            </Button>
            <Button className={combineClasses(buttonClasses.outline, textClasses.primary)}>Subscribe</Button>
            <Button className={combineClasses(buttonClasses.outline, textClasses.primary)}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default ProfileHeader
