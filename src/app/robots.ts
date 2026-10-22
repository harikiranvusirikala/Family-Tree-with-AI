import type { MetadataRoute } from "next";
import type { AuthUrlEnv } from "@/server/auth-urls";
import { robotsFor } from "@/server/site";

/** robots.txt: on the live site, the landing page and the sitemap; elsewhere nothing (src/server/site.ts). */
export default function robots(): MetadataRoute.Robots {
  return robotsFor(process.env as AuthUrlEnv);
}
