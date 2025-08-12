"use client";
import Image, { type StaticImageData } from "next/image";
import {
  bgClasses,
  textClasses,
  componentClasses,
  borderClasses,
  combineClasses,
} from "@/lib/theme-classes";
import { useState, useEffect } from "react";

interface ProfileHeaderProps {
  avatar: StaticImageData | string | File;
  onAvatarClick: () => void;
}

export function ProfileHeader({ avatar, onAvatarClick }: ProfileHeaderProps) {
  const [avatarSrc, setAvatarSrc] = useState<string | StaticImageData>(() => {
    if (avatar instanceof File) {
      return URL.createObjectURL(avatar);
    }
    return avatar as string | StaticImageData;
  });

  useEffect(() => {
    if (avatar instanceof File) {
      // Create object URL for File objects
      const objectURL = URL.createObjectURL(avatar);
      setAvatarSrc(objectURL);

      // Cleanup object URL when component unmounts or avatar changes
      return () => {
        URL.revokeObjectURL(objectURL);
      };
    } else {
      setAvatarSrc(avatar);
    }
  }, [avatar]);

  return (
    <div className={combineClasses(componentClasses.card, "p-4 mb-6")}>
      <div className="flex items-center gap-4">
        <div
          className={combineClasses(
            "relative sm:w-24 w-24 h-20 sm:h-24 rounded-full overflow-hidden border-2 p-2",
            borderClasses.primary
          )}
        >
          {typeof avatarSrc === "string" &&
          avatarSrc.includes("cloudinary.com") ? (
            <img
              src={avatarSrc}
              alt="Profile Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <Image
              src={avatarSrc || "/placeholder.svg"}
              alt="Profile Avatar"
              fill
              className="object-cover"
              priority
            />
          )}
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
