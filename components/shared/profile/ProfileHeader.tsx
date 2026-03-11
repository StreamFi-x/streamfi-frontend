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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-highlight shrink-0">
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
        <div className="min-w-0">
          <h1 className="text-foreground text-base sm:text-xl font-bold truncate">
            {username}
          </h1>
          <p className="text-muted-foreground text-sm">
            {followers.toLocaleString()} followers
          </p>
        </div>
      </div>

      {/* Action buttons — wrap on mobile, single row on sm+ */}
      <div className="flex items-center gap-2 flex-wrap">
        {isOwner ? (
          <CustomizeChannelButton />
        ) : (
          <>
            <Button
              size="sm"
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
            {stellarPublicKey &&
            userStellarPublicKey &&
            userStellarPublicKey !== stellarPublicKey &&
            onTipClick ? (
              <TipButton
                recipientUsername={username}
                recipientPublicKey={stellarPublicKey}
                onTipClick={onTipClick}
                variant="outline"
                className="bg-transparent border border-border hover:bg-accent text-foreground"
              />
            ) : null}
            <Button
              size="sm"
              className="bg-transparent border border-border hover:bg-accent text-foreground"
            >
              Subscribe
            </Button>
            <Button
              size="sm"
              className="bg-transparent border border-border hover:bg-accent text-foreground px-2"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
