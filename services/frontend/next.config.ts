import type { NextConfig } from "next";

const apiGatewayUrl = process.env.API_GATEWAY_URL || "http://api-gateway:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/gateway/:path*",
        destination: `${apiGatewayUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
