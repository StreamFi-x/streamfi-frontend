"use client";

import type React from "react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Info } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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
  isSaving?: boolean;
  /** When provided, renders a "Go to Dashboard" link in the footer */
  dashboardHref?: string;
}

export default function StreamInfoModal({
  initialData,
  onClose,
  onSave,
  isSaving = false,
  dashboardHref,
}: StreamInfoModalProps) {
  const [tags, setTags] = useState(initialData.tags || []);
  const [newTag, setNewTag] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    initialData.thumbnail ?? null
  );
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
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
    const trimmed = newTag.trim();
    if (!trimmed || tags.length >= 4 || tags.includes(trimmed)) {return;}
    setTags([...tags, trimmed]);
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const processFile = (file: File) => {
    setThumbnailError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setThumbnailError("Please upload a JPEG, PNG, or WebP image");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setThumbnailError("Image must be less than 4MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      if (e.target?.result) {setThumbnailPreview(e.target.result as string);}
    };
    reader.readAsDataURL(file);
    setThumbnailFile(file);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {processFile(file);}
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {processFile(file);}
  };

  const onSubmit = (data: StreamInfoFormData) => {
    onSave({ ...data, tags, thumbnail: thumbnailPreview ?? null });
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) {onClose();} }}
      >
        <motion.div
          className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.18 }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Edit Stream Info</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-4 scrollbar-hide">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Title <span className="text-red-500 normal-case">*</span>
                </label>
                <input
                  type="text"
                  {...register("title")}
                  placeholder="Enter your stream title"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-highlight focus:outline-none transition-colors"
                />
                {errors.title && (
                  <p className="text-xs text-red-500">{errors.title.message}</p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Category
                </label>
                <input
                  type="text"
                  {...register("category")}
                  placeholder="e.g. Gaming, Music, IRL"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-highlight focus:outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  placeholder="Tell viewers what your stream is about"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-highlight focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Thumbnail */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Thumbnail <span className="text-muted-foreground normal-case font-normal">(1200×640, max 4MB)</span>
                </label>
                <div
                  className="border border-dashed border-border rounded-lg cursor-pointer hover:border-highlight transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {thumbnailPreview ? (
                    <div className="relative">
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="w-full h-36 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setThumbnailPreview(null);
                          setThumbnailFile(null);
                        }}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 rounded-full p-1 transition-colors"
                        aria-label="Remove thumbnail"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                      {thumbnailFile && (
                        <p className="text-[10px] text-muted-foreground px-3 py-1.5 truncate">
                          {thumbnailFile.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-foreground">Drag & drop or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WebP</p>
                    </div>
                  )}
                </div>
                {thumbnailError && (
                  <p className="text-xs text-red-500">{thumbnailError}</p>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleThumbnailChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Tags <span className="text-muted-foreground normal-case font-normal">(max 4)</span>
                </label>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 px-2.5 py-1 bg-secondary border border-border rounded-lg text-xs text-foreground group"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                    placeholder="Add a tag"
                    disabled={tags.length >= 4}
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-highlight focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!newTag.trim() || tags.length >= 4}
                    className="px-3 py-2 text-xs font-semibold bg-highlight/10 hover:bg-highlight/20 text-highlight rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {tags.length >= 4 && (
                  <p className="text-xs text-yellow-500">Maximum 4 tags reached</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 pt-2">
                {dashboardHref ? (
                  <Link
                    href={dashboardHref}
                    onClick={onClose}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Go to Dashboard →
                  </Link>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-semibold border border-border hover:bg-muted text-foreground rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isValid || isSaving}
                    className="px-4 py-2 text-sm font-semibold bg-highlight hover:bg-highlight/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
