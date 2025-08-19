"use client";

import { useState } from "react";
import { Twitter, Instagram, DiscIcon as Discord, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StreamInfoModal from "@/components/dashboard/common/StreamInfoModal";

import Link from "next/link";

interface AboutSectionProps {
  username: string;
  followers: string[] | null;
  bio?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    discord?: string;
  };
  isOwner: boolean;
}

const AboutSection = ({
  username,
  followers,
  bio,
  socialLinks,
  isOwner,
}: AboutSectionProps) => {
  const [showBioModal, setShowBioModal] = useState(false);
  const [userBio, setUserBio] = useState(bio || "");

  const handleSaveBio = (data: unknown) => {
    if (typeof data === "object" && data !== null && "description" in data) {
      setUserBio((data as { description?: string }).description || "");
    } else {
      setUserBio("");
    }
    setShowBioModal(false);
  };

  return (
    <div className="bg-card border border-border shadow-sm rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-foreground text-lg font-medium">
            About {username}
          </h2>
          <span className="text-muted-foreground text-sm mr-4">
            <span className="text-highlight">
              {followers ? followers?.length : "0"}
            </span>{" "}
            followers
          </span>
        </div>

        <div className="flex items-center">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground border-none"
            >
              <Link href={`/settings/profile`} className="flex items-center">
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Bio
              </Link>
            </Button>
          )}
        </div>
      </div>

      {socialLinks && (
        <div className="flex space-x-4 mb-4">
          {socialLinks.twitter && (
            <a
              href={socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <Twitter className="h-5 w-5" />
            </a>
          )}
          {socialLinks.instagram && (
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <Instagram className="h-5 w-5" />
            </a>
          )}
          {socialLinks.discord && (
            <a
              href={socialLinks.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <Discord className="h-5 w-5" />
            </a>
          )}
        </div>
      )}

      {userBio ? (
        <p className="text-muted-foreground text-sm whitespace-pre-line">
          {userBio}
        </p>
      ) : (
        <div className="text-muted-foreground text-sm">
          {isOwner ? (
            <div className="bg-tertiary p-4 rounded-md">
              <p className="mb-2">You haven&apos;t added a bio yet.</p>
              <p>
                Tell viewers about yourself, your content, and your streaming
                schedule.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="bg-purple-600 hover:bg-purple-800 text-white dark:text-white border-none mt-3"
                onClick={() => setShowBioModal(true)}
              >
                Add Bio
              </Button>
            </div>
          ) : (
            <p>{username} hasn&apos;t added a bio yet.</p>
          )}
        </div>
      )}

      {showBioModal && (
        <StreamInfoModal
          initialData={{
            title: "",
            description: userBio,
            category: "",
            tags: [],
          }}
          onClose={() => setShowBioModal(false)}
          onSave={handleSaveBio}
        />
      )}
    </div>
  );
};

export default AboutSection;
