import type { MetadataRoute } from "next";
import { authUrls, type AuthUrlEnv } from "./auth-urls";

// What search engines may read, and where the site lives (the search engines request, 2026-10-22).
// Pure, so the rules are unit-tested; src/app/robots.ts, sitemap.ts and layout.tsx pass process.env.

/**
 * The site's address for canonical links, the sitemap and link-preview images: sign-in's base URL
 * (production's address in production, the branch's on a preview), or localhost when that isn't set,
 * as in a local build without .env.local.
 */
export function siteUrl(env: AuthUrlEnv): string {
  try {
    return authUrls(env).baseURL;
  } catch {
    return "http://localhost:3000";
  }
}

/** Only production is for search engines: previews and local builds ask them to stay away. */
export const isLiveSite = (env: AuthUrlEnv) => env.VERCEL_ENV === "production";

/** Pages that need signing in, the API and the developer pages: nothing there for search engines. */
const PRIVATE_PATHS = ["/api/", "/dashboard", "/g/", "/invite/", "/join/", "/dev/", "/admin"];

export function robotsFor(env: AuthUrlEnv): MetadataRoute.Robots {
  if (!isLiveSite(env)) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }, sitemap: `${siteUrl(env)}/sitemap.xml` };
}

/** The landing page is the only public page. */
export function sitemapFor(env: AuthUrlEnv): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl(env)}/` }];
}
