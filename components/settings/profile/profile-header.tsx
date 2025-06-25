"use client";
import Image, { type StaticImageData } from "next/image";
import {
  bgClasses,
  textClasses,
  componentClasses,
  combineClasses,
} from "@/lib/theme-classes";

interface ProfileHeaderProps {
  avatar: StaticImageData | string;
  onAvatarClick: () => void;
}

export function ProfileHeader({ avatar, onAvatarClick }: ProfileHeaderProps) {
  return (
    <div className={combineClasses(componentClasses.card, "p-4 mb-6")}>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-purple-700">
          <Image
            src={avatar || "/placeholder.svg"}
            alt="Profile Avatar"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div>
          <button
            onClick={onAvatarClick}
            className={combineClasses(
              bgClasses.input,
              textClasses.primary,
              "px-3 py-2 rounded text-sm hover:bg-[#333] transition"
            )}
          >
            Edit Avatar
          </button>
          <p className={combineClasses(textClasses.tertiary, "mt-2 text-xs")}>
            Must be JPEG, PNG, or GIF and cannot exceed 10MB
          </p>
        </div>
      </div>
    </div>
  );
}
