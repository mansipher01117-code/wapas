import type { NextConfig } from "next";

// The browser only talks to Next.js; /api and /media are forwarded to FastAPI.
// This lets you open the app from your phone on the same Wi-Fi with one URL.
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Dev is served on 0.0.0.0 so a phone on the same Wi-Fi can open it. Next blocks
  // its dev resources (HMR, hydration) for hosts it doesn't know, so allow the LAN.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],

  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
      { source: "/media/:path*", destination: `${BACKEND}/media/:path*` },
    ];
  },
  experimental: {
    proxyTimeout: 180_000,
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
