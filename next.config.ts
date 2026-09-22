import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kept intentionally empty for M1. Image domains, redirects, etc. will be
  // added here once real integrations (Supabase storage, carrier logos,
  // etc.) are introduced in a later milestone.
  reactStrictMode: true,
};

export default nextConfig;
