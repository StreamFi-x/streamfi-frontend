"use client";
import Image, { type StaticImageData } from "next/image";
import { PROFILE_ICONS } from "@/lib/profile-icons";
import { Camera } from "lucide-react";

import { useRef, useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast-provider";

const MAX_BANNER_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB hard limit before compression

/** Compress a banner image to JPEG ≤ 1920×600 at 85% quality using Canvas. */
async function compressImageFile(
  file: File,
  maxWidth = 1920,
  maxHeight = 600,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error("Image compression failed"));
            return;
          }
          const name = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}

interface ProfileHeaderProps {
  avatar: StaticImageData | string | File;
  onAvatarClick: () => void;
  banner: File | string | null;
  onBannerChange: (file: File) => void;
}

export function ProfileHeader({
  avatar,
  onAvatarClick,
  banner,
  onBannerChange,
}: ProfileHeaderProps) {
  const { showToast } = useToast();
  const [avatarSrc, setAvatarSrc] = useState<string | StaticImageData>(() => {
    if (avatar instanceof File) {
      return URL.createObjectURL(avatar);
    }
    return avatar as string | StaticImageData;
  });

  const [bannerSrc, setBannerSrc] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (avatar instanceof File) {
      const objectURL = URL.createObjectURL(avatar);
      setAvatarSrc(objectURL);
      return () => {
        URL.revokeObjectURL(objectURL);
      };
    } else {
      setAvatarSrc(avatar);
    }
  }, [avatar]);

  useEffect(() => {
    if (banner instanceof File) {
      const objectURL = URL.createObjectURL(banner);
      setBannerSrc(objectURL);
      return () => {
        URL.revokeObjectURL(objectURL);
      };
    } else if (typeof banner === "string" && banner.trim()) {
      setBannerSrc(banner);
    } else {
      setBannerSrc(null);
    }
  }, [banner]);

  const handleBannerFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }

    if (file.size > MAX_BANNER_SIZE_BYTES) {
      showToast(
        "Banner image must be under 10 MB. Please choose a smaller image.",
        "error"
      );
      return;
    }

    try {
      const compressed = await compressImageFile(file);
      onBannerChange(compressed);
    } catch {
      showToast(
        "Failed to process the image. Please try another file.",
        "error"
      );
    }
  };

  return (
    <div className="bg-card border border-border shadow-sm rounded-lg overflow-hidden mb-6">
      {/* Banner preview with hover-to-edit overlay */}
      <div
        className="relative w-full h-32 bg-gradient-to-r from-gray-900 to-gray-800 bg-center bg-cover bg-no-repeat"
        style={{
          backgroundImage: bannerSrc
            ? `url('${bannerSrc}')`
            : `url('/Images/banner-bg.png')`,
        }}
      >
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
          aria-label="Change banner"
        >
          <div className="flex items-center gap-2 bg-background/80 rounded-md px-3 py-1.5 text-sm text-foreground">
            <Camera className="h-4 w-4" />
            Edit Banner
          </div>
        </button>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleBannerFileChange}
        />
      </div>

      {/* Avatar row — pulled up to overlap the banner */}
      <div className="flex items-center gap-4 px-4 pb-4">
        <div className="relative sm:w-24 w-24 h-20 sm:h-24 rounded-full overflow-hidden border-2 p-2 border-border -mt-12 bg-card shrink-0">
          {typeof avatarSrc === "string" &&
          avatarSrc.includes("cloudinary.com") ? (
            <img
              src={avatarSrc}
              alt="Profile Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <Image
              src={avatarSrc || PROFILE_ICONS[0]}
              alt="Profile Avatar"
              fill
              className="object-cover"
              priority
            />
          )}
        </div>
        <div className="pt-2">
          <button
            onClick={onAvatarClick}
            className="bg-input text-foreground px-3 py-2 rounded text-sm hover:bg-[#333] transition"
          >
            Edit Avatar
          </button>
          <p className="text-muted-foreground mt-2 text-xs">
            Must be JPEG, PNG, or GIF and cannot exceed 10MB
          </p>
        </div>
      </div>
    </div>
  );
}
