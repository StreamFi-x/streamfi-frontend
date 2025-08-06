"use client";

import { useState } from "react";
import { Twitter, Instagram, DiscIcon as Discord, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StreamInfoModal from "@/components/dashboard/common/stream-info-modal";
import {
  bgClasses,
  textClasses,
  buttonClasses,
  componentClasses,
  combineClasses,
} from "@/lib/theme-classes";

interface AboutSectionProps {
  username: string;
  followers: number;
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
    <div className={combineClasses(componentClasses.card, "p-6 mb-6")}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col items-center gap-6">
          <h2
            className={combineClasses(
              textClasses.primary,
              "text-lg font-medium",
            )}
          >
            About {username}
          </h2>
          <span
            className={combineClasses(textClasses.secondary, "text-sm mr-4")}
          >
            <span className={textClasses.highlight}>
              {followers.toLocaleString()}
            </span>{" "}
            followers
          </span>
        </div>

        <div className="flex items-center">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className={combineClasses(
                buttonClasses.outline,
                textClasses.primary,
                "border-none",
              )}
              onClick={() => setShowBioModal(true)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Bio
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
              className={combineClasses(
                textClasses.tertiary,
                `hover:${textClasses.primary}`,
              )}
            >
              <Twitter className="h-5 w-5" />
            </a>
          )}
          {socialLinks.instagram && (
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={combineClasses(
                textClasses.tertiary,
                `hover:${textClasses.primary}`,
              )}
            >
              <Instagram className="h-5 w-5" />
            </a>
          )}
          {socialLinks.discord && (
            <a
              href={socialLinks.discord}
              target="_blank"
              rel="noopener noreferrer"
              className={combineClasses(
                textClasses.tertiary,
                `hover:${textClasses.primary}`,
              )}
            >
              <Discord className="h-5 w-5" />
            </a>
          )}
        </div>
      )}

      {userBio ? (
        <p
          className={combineClasses(
            textClasses.secondary,
            "text-sm whitespace-pre-line",
          )}
        >
          {userBio}
        </p>
      ) : (
        <div className={combineClasses(textClasses.tertiary, "text-sm")}>
          {isOwner ? (
            <div
              className={combineClasses(bgClasses.tertiary, "p-4 rounded-md")}
            >
              <p className="mb-2">You haven&apos;t added a bio yet.</p>
              <p>
                Tell viewers about yourself, your content, and your streaming
                schedule.
              </p>
              <Button
                variant="outline"
                size="sm"
                className={combineClasses(
                  buttonClasses.secondary,
                  textClasses.onColor,
                  "border-none mt-3",
                )}
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
