"use client";

import { FolderOpen } from "lucide-react";
import { textClasses, bgClasses, combineClasses } from "@/lib/theme-classes";

export default function CategoriesPage() {
  return (
    <div className={combineClasses(bgClasses.card, "p-12 rounded-lg border text-center")}>
      <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
      <h3 className={combineClasses(textClasses.primary, "text-lg font-semibold mb-2")}>
        Categories Coming Soon
      </h3>
      <p className={combineClasses(textClasses.secondary, "mb-4")}>
        Browse content by categories will be available soon.
      </p>
      <p className={combineClasses(textClasses.tertiary, "text-sm")}>
        For now, explore live channels using the filters above.
      </p>
    </div>
  );
} 