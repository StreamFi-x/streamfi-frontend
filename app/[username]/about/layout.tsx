import type { Metadata } from "next";
import type { ReactNode } from "react";

const BASE = "https://www.streamfi.media";

interface Props {
  children: ReactNode;
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return {
    alternates: { canonical: `${BASE}/${username}/about` },
  };
}

export default function AboutLayout({ children }: Props) {
  return <>{children}</>;
}
