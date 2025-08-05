"use client";

import type React from "react";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import {
  bgClasses,
  textClasses,
  borderClasses,
  buttonClasses,
  ringClasses,
} from "@/lib/theme-classes";

// Form schema
const streamInfoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).max(4, "Maximum 4 tags allowed"),
  thumbnail: z.any().optional(),
});

type StreamInfoFormData = z.infer<typeof streamInfoSchema>;

interface StreamInfoModalProps {
  initialData: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    thumbnail?: string | null;
  };
  onClose: () => void;
  onSave: (data: StreamInfoFormData) => void;
}

export default function StreamInfoModal({
  initialData,
  onClose,
  onSave,
}: StreamInfoModalProps) {
  const [tags, setTags] = useState(initialData.tags || []);
  const [newTag, setNewTag] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState(
    initialData.thumbnail
  );
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<StreamInfoFormData>({
    resolver: zodResolver(streamInfoSchema),
    defaultValues: {
      title: initialData.title || "",
      description: initialData.description || "",
      category: initialData.category || "",
      tags: initialData.tags || [],
    },
    mode: "onChange",
  });

  const handleAddTag = () => {
    if (!newTag.trim() || tags.length >= 4) return;

    if (!tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  interface ThumbnailChangeEvent extends React.ChangeEvent<HTMLInputElement> {
    target: HTMLInputElement & { files: FileList };
  }

  const handleThumbnailChange = (e: ThumbnailChangeEvent): void => {
    const file: File | null = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes: string[] = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a JPEG, PNG, or WebP image");
      return;
    }

    // Validate file size (4MB max)
    if (file.size > 4 * 1024 * 1024) {
      alert("Image must be less than 4MB");
      return;
    }

    // Create preview
    const reader: FileReader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target && e.target.result) {
        setThumbnailPreview(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);

    setThumbnailFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  interface DropEvent extends React.DragEvent<HTMLDivElement> {
    dataTransfer: DataTransfer;
  }

  const handleDrop = (e: DropEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file: File = e.dataTransfer.files[0];

      // Validate file type
      const validTypes: string[] = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        alert("Please upload a JPEG, PNG, or WebP image");
        return;
      }

      // Validate file size (4MB max)
      if (file.size > 4 * 1024 * 1024) {
        alert("Image must be less than 4MB");
        return;
      }

      // Create preview
      const reader: FileReader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target && e.target.result) {
          setThumbnailPreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);

      setThumbnailFile(file);
    }
  };

  const onSubmit = (data: StreamInfoFormData): void => {
    // Combine form data with tags and thumbnail
    const updatedData: StreamInfoFormData & { thumbnail: string | null } = {
      ...data,
      tags,
      thumbnail: thumbnailPreview ?? null,
    };

    onSave(updatedData);
  };

  return (
    <AnimatePresence>
      <div
        className={`fixed inset-0 ${bgClasses.overlay} z-50 flex items-center justify-center p-4`}
      >
        <motion.div
          className={`${bgClasses.modal} rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden border ${borderClasses.primary}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className={`p-4 border-b ${borderClasses.primary} flex justify-between items-center`}
          >
            <h2 className={`text-xl font-semibold ${textClasses.primary}`}>
              Edit Stream Info
            </h2>
            <button
              onClick={onClose}
              className={`p-1 ${bgClasses.hover} rounded-md transition-colors`}
            >
              <X size={20} className={textClasses.secondary} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4">
                <label
                  className={`block text-sm font-medium mb-1 ${textClasses.primary}`}
                >
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register("title")}
                  className={`w-full ${bgClasses.input} border ${borderClasses.primary} rounded-md px-3 py-2 ${ringClasses.primary} ${textClasses.primary}`}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label
                  className={`block text-sm font-medium mb-1 ${textClasses.primary}`}
                >
                  Category
                </label>
                <input
                  type="text"
                  {...register("category")}
                  className={`w-full ${bgClasses.input} border ${borderClasses.primary} rounded-md px-3 py-2 ${ringClasses.primary} ${textClasses.primary}`}
                />
              </div>

              <div className="mb-4">
                <label
                  className={`block text-sm font-medium mb-1 ${textClasses.primary}`}
                >
                  Description
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className={`w-full ${bgClasses.input} border ${borderClasses.primary} rounded-md px-3 py-2 ${ringClasses.primary} ${textClasses.primary}`}
                />
              </div>

              <div className="mb-4">
                <label
                  className={`block text-sm font-medium mb-1 ${textClasses.primary}`}
                >
                  Thumbnail (1200x640, max 4MB)
                </label>
                <div
                  className={`border-2 border-dashed ${borderClasses.primary}  ${textClasses.primary} rounded-md p-4 text-center cursor-pointer hover:${borderClasses.hover} transition-colors`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {thumbnailPreview ? (
                    <div className="relative flex flex-col">
                      <Image
                        src={thumbnailPreview || "/Images/banner-bg.png"}
                        alt="Thumbnail preview"
                        className="max-h-40 mx-auo rounde-md max-w-14"
                        fill
                      />
                      <p>
                        {thumbnailFile ? thumbnailFile.name : "Default banner"}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setThumbnailPreview(null);
                          setThumbnailFile(null);
                        }}
                        className="absolute right-2 bg-red-500 rounded-full p-1 text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload
                        className={`mx-auto mb-2 ${textClasses.secondary}`}
                        size={24}
                      />
                      <p className={textClasses.primary}>
                        Drag and drop an image here or click to browse
                      </p>
                      <p className={`text-sm ${textClasses.tertiary} mt-1`}>
                        JPEG, PNG, or WebP (1200x640)
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleThumbnailChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label
                  className={`block text-sm font-medium mb-1 ${textClasses.primary}`}
                >
                  Tags (max 4)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <div
                      key={tag}
                      className={`px-2 py-1 ${bgClasses.card} rounded-md text-sm flex items-center group border ${borderClasses.primary}`}
                    >
                      <span className={textClasses.primary}>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} className={textClasses.secondary} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag"
                    className={`flex-1 ${bgClasses.input} border ${borderClasses.primary} rounded-l-md px-3 py-2 ${ringClasses.primary} ${textClasses.primary}`}
                    disabled={tags.length >= 4}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!newTag.trim() || tags.length >= 4}
                    className={`${buttonClasses.primary} disabled:${bgClasses.tertiary} disabled:${textClasses.tertiary} px-4 rounded-r-md transition-colors`}
                  >
                    Add
                  </button>
                </div>
                {tags.length >= 4 && (
                  <p className="mt-1 text-sm text-yellow-500">
                    Maximum 4 tags allowed
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 ${buttonClasses.outline} rounded-md transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid}
                  className={`px-4 py-2 ${buttonClasses.primary} disabled:${bgClasses.tertiary} disabled:${textClasses.tertiary} rounded-md transition-colors`}
                >
                  Done
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
