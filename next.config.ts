import type { NextConfig } from "next";
import { securityHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  logging: { incomingRequests: false },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders(process.env.NODE_ENV === "development") }];
  },
};

export default nextConfig;
