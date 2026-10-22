import type { MetadataRoute } from "next";
import type { AuthUrlEnv } from "@/server/auth-urls";
import { sitemapFor } from "@/server/site";

/** sitemap.xml: the landing page, the only public page (src/server/site.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor(process.env as AuthUrlEnv);
}
