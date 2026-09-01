import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/gateway/:path*",
        destination: "http://api-gateway:8080/:path*",
      },
    ];
  },
};

export default nextConfig;
