import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Browse Categories",
  description:
    "Find live streams by category on StreamFi. Explore gaming, music, creative, IRL, sports and dozens more.",
  openGraph: {
    title: "Browse Categories | StreamFi",
    description:
      "Find live streams by category on StreamFi. Explore gaming, music, creative, IRL, sports and dozens more.",
    url: "https://www.streamfi.media/browse/category",
  },
};

export default function BrowseCategoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
