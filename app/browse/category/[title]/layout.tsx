import type { Metadata } from "next";
import type { ReactNode } from "react";

interface Props {
  params: Promise<{ title: string }>;
  children: ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { title } = await params;
  const name = decodeURIComponent(title);
  const display = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    title: `${display} Streams`,
    description: `Watch live ${display} streams on StreamFi. Find the best ${display} content from creators worldwide.`,
    openGraph: {
      title: `${display} Streams | StreamFi`,
      description: `Watch live ${display} streams on StreamFi. Find the best ${display} content from creators worldwide.`,
      url: `https://www.streamfi.media/browse/category/${title}`,
    },
  };
}

export default function CategoryTitleLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
