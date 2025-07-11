import type { Metadata } from "next";
import { Providers } from "../components/providers";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://streamfi.com", // Replace with your actual domain
  ),
  title: {
    default: "Streamfi - Own Your Stream. Own Your Earnings",
    template: "%s - Streamfi",
  },
  description:
    "Stream without limits, engage your community, and earn instantly with a blockchain-powered ecosystem that ensures true ownership, decentralized rewards, and frictionless transactions.",
  openGraph: {
    title: "Streamfi - Own Your Stream. Own Your Earnings",
    description:
      "Stream without limits, engage your community, and earn instantly with a blockchain-powered ecosystem that ensures true ownership.",
    siteName: "Streamfi",
    images: [
      {
        url: "/Images/streamFi.png",
        width: 1200,
        height: 630,
        alt: "Streamfi Preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Streamfi - Own Your Stream. Own Your Earnings",
    description:
      "Stream without limits, engage your community, and earn instantly with a blockchain-powered ecosystem that ensures true ownership.",
    images: ["/Images/streamFi.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-transparent">
      <body className="antialiased">
        <Providers>
          {children}
          <Toaster position="top-right" closeButton />
        </Providers>
      </body>
    </html>
  );
}
