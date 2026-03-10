/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required when webpack config is present alongside Turbopack (Next 16)
  turbopack: {},
  experimental: {
    // Prevent Next.js from parsing all exports of large barrel packages —
    // only the icons/components actually used get compiled.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  allowedDevOrigins: ["*.ngrok-free.app"],
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
  async headers() {
    return [
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
          // Content Security Policy
          // - Privy loads iframes from auth.privy.io
          // - Mux player scripts come from cdn.mux.com
          // - Google fonts are common; tighten if you don't use them
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://auth.privy.io https://cdn.mux.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://images.unsplash.com https://picsum.photos https://image.mux.com",
              "media-src 'self' blob: https://*.mux.com",
              "frame-src https://*.privy.io https://*.walletconnect.com",
              "connect-src 'self' https://*.privy.io wss://*.walletconnect.com https://*.walletconnect.com https://*.neon.tech https://*.mux.com https://*.litix.io https://horizon-testnet.stellar.org https://horizon.stellar.org",
              "worker-src 'self' blob:",
            ].join("; "),
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

export default nextConfig;
