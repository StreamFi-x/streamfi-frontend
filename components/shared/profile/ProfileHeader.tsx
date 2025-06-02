import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ExternalLink } from "lucide-react";
import CustomizeChannelButton from "./CustomizeChannelButton";

interface ProfileHeaderProps {
  username: string;
  followers: number;
  avatarUrl: string;
  isOwner: boolean;
}

const ProfileHeader = ({
  username,
  followers,
  avatarUrl,
  isOwner,
}: ProfileHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-purple-600 mr-4">
          <Image
            src={avatarUrl || "/Images/user.png"}
            alt={username}
            fill
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{username}</h1>
          <p className="text-sm text-gray-400">
            {followers.toLocaleString()} followers
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {isOwner ? (
          <CustomizeChannelButton />
        ) : (
          <>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white border-none">
              Follow
            </Button>
            <Button className="bg-transparent hover:bg-gray-700 text-white border-gray-600">
              Subscribe
            </Button>
            <Button className="bg-transparent hover:bg-gray-700 text-white border-gray-600">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
