import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import CustomizeChannelButton from "./CustomizeChannelButton";
import { TipButton } from "@/components/tipping";

interface ProfileHeaderProps {
  username: string;
  followers: number;
  avatarUrl: string;
  isOwner: boolean;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  followLoading: boolean;
  stellarPublicKey?: string;
  userStellarPublicKey?: string;
  onTipClick?: () => void;
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
  stellarPublicKey,
  userStellarPublicKey,
  onTipClick,
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
              className="bg-highlight hover:bg-highlight/80 text-primary-foreground border-none"
              onClick={isFollowing ? onUnfollow : onFollow}
              disabled={followLoading}
            >
              {followLoading
                ? "Loading..."
                : isFollowing
                  ? "Unfollow"
                  : "Follow"}
            </Button>
            {/* Stellar Tip Button */}
            {stellarPublicKey &&
            userStellarPublicKey &&
            userStellarPublicKey !== stellarPublicKey &&
            onTipClick ? (
              <TipButton
                recipientUsername={username}
                recipientPublicKey={stellarPublicKey}
                onTipClick={onTipClick}
                variant="outline"
                className="bg-transparent border border-border hover:bg-surface-hover text-foreground"
              />
            ) : null}
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
