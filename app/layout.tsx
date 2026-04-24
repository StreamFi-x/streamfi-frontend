import type { Metadata } from "next";
import { Providers } from "../components/providers";
import "./globals.css";
import { Toaster } from "sonner";
import React from "react";
import SidebarWrapper from "../components/SidebarWrapper";

const BASE_URL = "https://www.streamfi.media";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "StreamFi – Own Your Stream. Own Your Earnings",
    template: "%s | StreamFi",
  },
  description:
    "Stream without limits, engage your community, and earn instantly with a blockchain-powered ecosystem that ensures true ownership, decentralized rewards, and frictionless transactions.",
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "StreamFi – Own Your Stream. Own Your Earnings",
    description:
      "Stream without limits, engage your community, and earn instantly with a blockchain-powered ecosystem that ensures true ownership.",
    siteName: "StreamFi",
    url: BASE_URL,
    images: [
      {
        url: "/Images/streamFi.png",
        width: 1200,
        height: 630,
        alt: "StreamFi – Blockchain-powered live streaming",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "StreamFi – Own Your Stream. Own Your Earnings",
    description:
      "Stream without limits, engage your community, and earn instantly with a blockchain-powered ecosystem that ensures true ownership.",
    images: ["/Images/streamFi.png"],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "StreamFi",
  url: BASE_URL,
  logo: `${BASE_URL}/Images/streamFi.png`,
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: BASE_URL,
  name: "StreamFi",
  potentialAction: {
    "@type": "SearchAction",
    target: `${BASE_URL}/browse/live?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-transparent">
      <body className="antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <Providers>
          <SidebarWrapper>{children}</SidebarWrapper>
          <Toaster position="top-right" closeButton />
        </Providers>
      </body>
    </html>
  );
}
