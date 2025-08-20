import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import CustomizeChannelButton from "./CustomizeChannelButton";

interface ProfileHeaderProps {
  username: string;
  followers: number;
  avatarUrl: string;
  isOwner: boolean;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  followLoading: boolean;
}

const ProfileHeader = ({
  username,
  followers,
  avatarUrl,
  isOwner,
  isFollowing,
  onFollow,
  onUnfollow,
  followLoading,
}: ProfileHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-4">
      <div className="flex items-center">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-purple-600 mr-4">
          {typeof avatarUrl === "string" &&
          avatarUrl.includes("cloudinary.com") ? (
            <img
              src={avatarUrl}
              alt={username}
              className="w-full h-full object-cover"
            />
          ) : (
            <Image
              src={avatarUrl || "/Images/user.png"}
              alt={username}
              fill
              className="object-cover"
            />
          )}
        </div>
        <div>
          <h1 className="text-foreground text-base sm:text-xl font-bold">
            {username}
          </h1>
          <p className="text-muted-foreground text-sm">
            {followers.toLocaleString()} followers
          </p>
        </div>
      </div>

      <div className="flex items-center sm:space-x-2">
        {isOwner ? (
          <CustomizeChannelButton />
        ) : (
          <>
            <Button
              className="bg-purple-600 hover:bg-purple-800 text-white dark:text-white border-none"
              onClick={isFollowing ? onUnfollow : onFollow}
              disabled={followLoading}
            >
              {followLoading
                ? "Loading..."
                : isFollowing
                  ? "Unfollow"
                  : "Follow"}
            </Button>
            <Button className="bg-transparent border border-border hover:bg-surface-hover text-foreground">
              Subscribe
            </Button>
            <Button className="bg-transparent border border-border hover:bg-surface-hover text-foreground">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
