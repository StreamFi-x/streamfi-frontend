import type { Metadata } from "next";
import { Providers } from "../components/providers";
import "./globals.css";
import { Toaster } from "sonner";
import MobNav from "@/components/settings/mob-nav";
import NextQueryProvider from "@/components/providers/NextQueryProvider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://streamfi.com" // Replace with your actual domain
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
    <html lang="en" className="">
      <body className="antialiased bg-[#16062B]">
        <Providers>
          <NextQueryProvider>
            {children}
            <MobNav />
            <Toaster position="top-right" closeButton />
          </NextQueryProvider>
        </Providers>
      </body>
    </html>
  );
}