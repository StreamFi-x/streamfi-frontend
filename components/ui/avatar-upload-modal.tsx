"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import { AlertCircle, Upload, X } from "lucide-react";
import { PROFILE_ICONS } from "@/lib/profile-icons";

export type AvatarValue = string | StaticImageData | File;

export interface AvatarUploadModalProps {
  isOpen?: boolean;
  currentAvatar: AvatarValue;
  onClose: () => void;
  onSaveAvatar: (avatar: AvatarValue) => void;
  avatarOptions?: readonly (string | StaticImageData)[];
  title?: string;
  maxSizeBytes?: number;
  acceptedTypes?: readonly string[];
}

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

function shouldUseNativeImg(src: string | StaticImageData): src is string {
  if (typeof src !== "string") {
    return false;
  }
  return (
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    src.includes("cloudinary.com") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  );
}

export const AvatarUploadModal: React.FC<AvatarUploadModalProps> = ({
  isOpen = true,
  currentAvatar,
  onClose,
  onSaveAvatar,
  avatarOptions = PROFILE_ICONS,
  title = "Edit Avatar",
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
}) => {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeObjectUrlRef = useRef<string | null>(null);

  const [selectedAvatar, setSelectedAvatar] =
    useState<AvatarValue>(currentAvatar);
  const [previewSrc, setPreviewSrc] = useState<string | StaticImageData>(() =>
    currentAvatar instanceof File ? PROFILE_ICONS[0] : currentAvatar
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const revokeActiveObjectUrl = useCallback(() => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, []);

  // Sync preview whenever modal opens or currentAvatar changes
  useEffect(() => {
    if (!isOpen) {
      revokeActiveObjectUrl();
      return;
    }

    setSelectedAvatar(currentAvatar);
    setValidationError(null);
    revokeActiveObjectUrl();

    if (currentAvatar instanceof File) {
      const objectUrl = URL.createObjectURL(currentAvatar);
      activeObjectUrlRef.current = objectUrl;
      setPreviewSrc(objectUrl);
    } else {
      setPreviewSrc(currentAvatar || PROFILE_ICONS[0]);
    }

    return () => {
      revokeActiveObjectUrl();
    };
  }, [currentAvatar, isOpen, revokeActiveObjectUrl]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleFileUploadClick = () => {
    setValidationError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!acceptedTypes.includes(file.type)) {
      setValidationError("File must be JPEG, PNG, GIF, or WebP.");
      return;
    }

    if (file.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      setValidationError(`File size cannot exceed ${maxMb}MB.`);
      return;
    }

    revokeActiveObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    activeObjectUrlRef.current = objectUrl;

    setValidationError(null);
    setSelectedAvatar(file);
    setPreviewSrc(objectUrl);
  };

  const handleSelectPreset = (preset: string | StaticImageData) => {
    revokeActiveObjectUrl();
    setValidationError(null);
    setSelectedAvatar(preset);
    setPreviewSrc(preset);
  };

  const handleSaveChanges = () => {
    if (selectedAvatar) {
      onSaveAvatar(selectedAvatar);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6 max-w-md w-full relative max-h-[90vh] overflow-y-auto"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id={titleId} className="text-xl font-bold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close avatar modal"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-purple-600 border-2 border-white/10">
            {shouldUseNativeImg(previewSrc) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt="Avatar Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={previewSrc}
                alt="Avatar Preview"
                fill
                className="object-cover"
              />
            )}
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={acceptedTypes.join(",")}
          aria-label="Upload avatar image"
          className="hidden"
        />

        <button
          type="button"
          onClick={handleFileUploadClick}
          className="w-full bg-[#2a2a2a] text-white py-3 rounded-md hover:bg-[#333] transition mb-3 flex items-center justify-center gap-2"
        >
          <Upload size={16} />
          Upload from device
        </button>

        {validationError && (
          <div
            role="alert"
            className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2 mb-4"
          >
            <AlertCircle size={14} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <p className="text-gray-400 text-sm text-center mb-6">
          Upload in JPEG, PNG, GIF, or WebP format with a maximum size of{" "}
          {Math.round(maxSizeBytes / (1024 * 1024))}MB.
        </p>

        {avatarOptions.length > 0 && (
          <>
            <div className="w-full h-px bg-gray-800 mb-6" />

            <p className="text-center text-white mb-4">
              or choose from the avatars below
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6 justify-items-center">
              {avatarOptions.map((avatar, index) => {
                const isSelected = previewSrc === avatar;
                return (
                  <button
                    key={typeof avatar === "string" ? avatar : index}
                    type="button"
                    onClick={() => handleSelectPreset(avatar)}
                    aria-label={`Select avatar option ${index + 1}`}
                    aria-pressed={isSelected}
                    className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden border-2 ${
                      isSelected
                        ? "border-purple-500"
                        : "border-transparent hover:border-purple-500"
                    } focus:border-purple-500 transition`}
                  >
                    {shouldUseNativeImg(avatar) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatar}
                        alt={`Avatar option ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image
                        src={avatar}
                        alt={`Avatar option ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleSaveChanges}
          className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3 rounded-md transition font-medium"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default AvatarUploadModal;
