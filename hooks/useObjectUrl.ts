"use client";

import { useEffect, useState } from "react";
import type { StaticImageData } from "next/image";

export type MediaSource = string | StaticImageData | File | null | undefined;

/**
 * Safely resolves a File, URL string, or StaticImageData into a renderable src.
 * Object URLs created for File instances are always revoked when the file
 * changes or the consuming component unmounts.
 */
export function useObjectUrl(
  source: MediaSource
): string | StaticImageData | null {
  const [resolved, setResolved] = useState<string | StaticImageData | null>(
    () => {
      if (!source || source instanceof File) {
        return null;
      }
      if (typeof source === "string") {
        return source.trim() ? source : null;
      }
      return source;
    }
  );

  useEffect(() => {
    if (source instanceof File) {
      const objectUrl = URL.createObjectURL(source);
      setResolved(objectUrl);
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    if (typeof source === "string") {
      setResolved(source.trim() ? source : null);
      return;
    }

    setResolved(source ?? null);
  }, [source]);

  return resolved;
}
