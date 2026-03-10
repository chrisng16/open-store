import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [new URL('https://static.photos/food/640x360/**')],
  },
};

export default nextConfig;
