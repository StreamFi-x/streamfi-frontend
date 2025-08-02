/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'res.cloudinary.com'],
  },
};

// Debug: Log the config to verify it's being loaded
console.log('Next.js config loaded:', nextConfig);

module.exports = nextConfig;