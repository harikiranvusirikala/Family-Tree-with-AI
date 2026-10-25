// @vitest-environment node
import { describe, expect, test } from "vitest";
import { robotsFor, siteUrl, sitemapFor } from "./site";

const vercel = {
  VERCEL_URL: "family-tree-abc123-team.vercel.app",
  VERCEL_BRANCH_URL: "family-tree-git-seo-team.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "family-tree-with-ai.vercel.app",
};
const production = { ...vercel, VERCEL_ENV: "production", BETTER_AUTH_URL: "https://family-tree-with-ai.vercel.app" };
const preview = { ...vercel, VERCEL_ENV: "preview" };

describe("siteUrl", () => {
  test("production's address in production, even without BETTER_AUTH_URL", () => {
    expect(siteUrl(production)).toBe("https://family-tree-with-ai.vercel.app");
    expect(siteUrl({ ...vercel, VERCEL_ENV: "production" })).toBe("https://family-tree-with-ai.vercel.app");
  });

  test("the branch's address on a preview, and BETTER_AUTH_URL locally and in tests", () => {
    expect(siteUrl(preview)).toBe("https://family-tree-git-seo-team.vercel.app");
    expect(siteUrl({ BETTER_AUTH_URL: "http://localhost:3100/" })).toBe("http://localhost:3100");
  });

  test("localhost when nothing says where the site is, rather than failing the build", () => {
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});

describe("robots.txt", () => {
  test("production: the landing page and the sitemap, not the private pages, the API or the developer pages", () => {
    expect(robotsFor(production)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/g/", "/invite/", "/join/", "/dev/", "/admin"] },
      sitemap: "https://family-tree-with-ai.vercel.app/sitemap.xml",
    });
  });

  test("previews and local builds keep every search engine out", () => {
    for (const env of [preview, { BETTER_AUTH_URL: "http://localhost:3100" }, {}]) {
      expect(robotsFor(env)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    }
  });
});

describe("sitemap.xml", () => {
  test("lists only the landing page, at the site's own address", () => {
    expect(sitemapFor(production)).toEqual([{ url: "https://family-tree-with-ai.vercel.app/" }]);
    expect(sitemapFor({ BETTER_AUTH_URL: "http://localhost:3100" })).toEqual([{ url: "http://localhost:3100/" }]);
  });
});
