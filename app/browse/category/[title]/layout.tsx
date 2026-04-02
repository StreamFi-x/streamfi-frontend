import type { Metadata } from "next";
import React from "react";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://streamfi.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ title: string }>;
}): Promise<Metadata> {
  const { title } = await params;
  const decodedTitle = decodeURIComponent(title);
  const canonical = `${BASE}/browse/category/${title}`;

  return {
    title: `${decodedTitle} streams`,
    description: `Watch the best ${decodedTitle} streams live on StreamFi`,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${decodedTitle} streams — StreamFi`,
      description: `Watch the best ${decodedTitle} streams live on StreamFi`,
      url: canonical,
      type: "website",
    },
  };
}

export default function CategoryTitleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
