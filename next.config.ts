import type { NextConfig } from "next";
import { securityHeaders } from "./src/server/security-headers";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders(process.env) }];
  },
  partialPrefetching: true,
  experimental: {
    // Imports send their operations to a server action (step 10): up to 2,000 people. Vercel's own
    // limit is 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
