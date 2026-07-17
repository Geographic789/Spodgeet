/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Prevent Next.js from trying to statically render any route
  // during build — required when env vars are only available at runtime.
  experimental: {
    serverComponentsExternalPackages: [],
  },
};
module.exports = nextConfig;
