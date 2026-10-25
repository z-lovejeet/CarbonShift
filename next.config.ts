import type { NextConfig } from "next";
import { securityHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  logging: { incomingRequests: false },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders(process.env.NODE_ENV === "development", process.env.NEXT_PUBLIC_SUPABASE_URL) }];
  },
};

export default nextConfig;
