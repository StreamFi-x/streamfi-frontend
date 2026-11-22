/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required when webpack config is present alongside Turbopack (Next 16)
  turbopack: {},
  experimental: {
    // Prevent Next.js from parsing all exports of large barrel packages —
    // only the icons/components actually used get compiled.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  allowedDevOrigins: ["*.ngrok-free.app", "127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "image.mux.com",
        port: "",
        pathname: "/**",
      },
    ],
    domains: ["localhost"],
  },

  // Security headers — defense-in-depth
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      return {
        beforeFiles: [
          {
            source: "/api/debug/:path*",
            destination: "/404",
          },
        ],
      };
    }
    return [];
  },

  async headers() {
    return [
      // Noindex private routes (layouts are "use client" so metadata API can't be used there)
      {
        source: "/dashboard/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/settings/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Stop MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Minimal referrer leakage
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable unused browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          // Enforce HTTPS for 1 year (production only — ignored on HTTP)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Prevent cross-origin isolation issues
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    NEXT_PUBLIC_VERCEL_ENV:
      process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || "",
  },

  // Bundle analyzer (optional - for production optimization)
  ...(process.env.ANALYZE === "true" && {
    webpack: async config => {
      const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
      config.plugins.push(
        bundleAnalyzer({
          enabled: true,
        })
      );
      return config;
    },
  }),
};

import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
