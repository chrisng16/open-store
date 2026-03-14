import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [new URL('https://static.photos/food/640x360/**')],
  },
};

export default nextConfig;
