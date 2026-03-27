"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";

interface Category {
  id: string;
  title: string;
  imageurl: string | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }
  return res.json();
};

// ── Category form dialog ───────────────────────────────────────────────────────
function CategoryFormDialog({
  initial,
  onClose,
  onSave,
}: {
  initial?: Category;
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [imageurl, setImageurl] = useState(initial?.imageurl ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(initial?.imageurl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isEditing = !!initial;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setImageurl(""); // clear manual URL when file selected
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      let finalImageUrl = imageurl;

      // If a file was selected, upload it first
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        const uploadRes = await fetch("/api/admin/categories/image", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          finalImageUrl = url;
        }
      }

      if (isEditing) {
        await fetch(`/api/category?id=${encodeURIComponent(initial!.title)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            imageurl: finalImageUrl || null,
          }),
        });
      } else {
        await fetch("/api/category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            imageurl: finalImageUrl || null,
          }),
        });
      }

      onSave();
      onClose();
    } catch {
      setError("Failed to save category. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-sidebar rounded-xl border border-border p-6 w-full max-w-md mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">
            {isEditing ? "Edit Category" : "New Category"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Category name"
              className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-highlight border border-border"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Image URL
            </label>
            <input
              type="text"
              value={imageurl}
              onChange={e => {
                setImageurl(e.target.value);
                setPreviewUrl(e.target.value);
                setImageFile(null);
              }}
              placeholder="https://res.cloudinary.com/…"
              className="w-full bg-input text-foreground rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-highlight border border-border"
            />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">or</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs text-highlight hover:underline"
              >
                Upload image file
              </button>
              {imageFile && (
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {imageFile.name}
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {previewUrl && (
            <div className="w-24 h-24 rounded-lg overflow-hidden border border-border">
              <Image
                src={previewUrl}
                alt="Preview"
                width={96}
                height={96}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm bg-surface-hover text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm bg-highlight hover:bg-highlight/80 text-background font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Create"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Delete confirm dialog ──────────────────────────────────────────────────────
function DeleteCategoryDialog({
  category,
  onClose,
  onConfirm,
}: {
  category: Category;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-sidebar rounded-xl border border-border p-6 w-full max-w-sm mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Delete category?
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          <strong className="text-foreground">{category.title}</strong> will be
          permanently removed.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm bg-surface-hover text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-sm bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminCategoriesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const { mutate } = useSWRConfig();

  const { data, isLoading } = useSWR<{ categories: Category[] }>(
    "/api/category",
    fetcher,
    { revalidateOnFocus: false }
  );
  const categories = data?.categories ?? [];

  const invalidate = () => {
    mutate("/api/category", undefined, { revalidate: true });
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    await fetch(`/api/category?id=${encodeURIComponent(deleteTarget.title)}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    invalidate();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Category Management
        </motion.h1>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-highlight hover:bg-highlight/80 text-background text-sm font-medium"
        >
          <Plus size={15} /> New Category
        </motion.button>
      </div>

      <div className="bg-sidebar rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="px-4 py-3 font-medium">Thumbnail</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded bg-muted animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              : categories.map(cat => (
                  <tr
                    key={cat.id}
                    className="border-b border-border hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                        {cat.imageurl && (
                          <Image
                            src={cat.imageurl}
                            alt={cat.title}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {cat.title}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditTarget(cat)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(cat)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!isLoading && categories.length === 0 && (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No categories yet. Create one to get started.
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CategoryFormDialog
            onClose={() => setShowCreate(false)}
            onSave={invalidate}
          />
        )}
        {editTarget && (
          <CategoryFormDialog
            initial={editTarget}
            onClose={() => setEditTarget(null)}
            onSave={invalidate}
          />
        )}
        {deleteTarget && (
          <DeleteCategoryDialog
            category={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
