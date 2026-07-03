import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Use the OS certificate store when fetching Google Fonts at build time
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
