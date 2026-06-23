import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth-gated app: every route reads the Supabase session cookie, so routes are
  // inherently dynamic. Cache Components (PPR) is not a fit for Phase 1.
  cacheComponents: false,
};

export default nextConfig;
