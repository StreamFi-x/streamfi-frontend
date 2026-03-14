import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Live Now",
  description:
    "Watch what's streaming live right now on StreamFi. Browse live channels across gaming, music, art, IRL and more.",
  openGraph: {
    title: "Live Now | StreamFi",
    description:
      "Watch what's streaming live right now on StreamFi. Browse live channels across gaming, music, art, IRL and more.",
    url: "https://www.streamfi.media/browse/live",
  },
};

export default function BrowseLiveLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
