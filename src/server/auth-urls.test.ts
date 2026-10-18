// @vitest-environment node
import { describe, expect, test } from "vitest";
import { authUrls } from "./auth-urls";

const vercel = {
  VERCEL_URL: "family-tree-abc123-team.vercel.app",
  VERCEL_BRANCH_URL: "family-tree-git-step-5-team.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "family-tree-with-ai.vercel.app",
};

describe("authUrls", () => {
  test("local development uses BETTER_AUTH_URL, with no OAuth proxy", () => {
    expect(authUrls({ BETTER_AUTH_URL: "http://localhost:3000" })).toEqual({
      baseURL: "http://localhost:3000",
      trustedOrigins: ["http://localhost:3000"],
    });
  });

  test("the e2e build uses its own port", () => {
    expect(authUrls({ BETTER_AUTH_URL: "http://localhost:3100/" }).trustedOrigins).toEqual(["http://localhost:3100"]);
  });

  test("production uses BETTER_AUTH_URL and runs the proxy for previews", () => {
    expect(authUrls({ ...vercel, VERCEL_ENV: "production", BETTER_AUTH_URL: "https://family-tree-with-ai.vercel.app" })).toEqual({
      baseURL: "https://family-tree-with-ai.vercel.app",
      trustedOrigins: ["https://family-tree-with-ai.vercel.app"],
      productionURL: "https://family-tree-with-ai.vercel.app",
    });
  });

  test("a preview trusts exactly its branch and deployment URLs, and signs in through production", () => {
    expect(authUrls({ ...vercel, VERCEL_ENV: "preview" })).toEqual({
      baseURL: "https://family-tree-git-step-5-team.vercel.app",
      trustedOrigins: ["https://family-tree-git-step-5-team.vercel.app", "https://family-tree-abc123-team.vercel.app"],
      productionURL: "https://family-tree-with-ai.vercel.app",
    });
  });

  test("a preview ignores BETTER_AUTH_URL if it was set there by mistake", () => {
    const urls = authUrls({ ...vercel, VERCEL_ENV: "preview", BETTER_AUTH_URL: "https://family-tree-with-ai.vercel.app" });
    expect(urls.trustedOrigins).not.toContain("https://family-tree-with-ai.vercel.app");
  });

  test("a preview without a branch URL (deployed from the CLI) uses its deployment URL", () => {
    const noBranch = { ...vercel, VERCEL_BRANCH_URL: undefined };
    expect(authUrls({ ...noBranch, VERCEL_ENV: "preview" }).trustedOrigins).toEqual(["https://family-tree-abc123-team.vercel.app"]);
  });

  test("never trusts a wildcard origin", () => {
    for (const env of [{ BETTER_AUTH_URL: "http://localhost:3000" }, { ...vercel, VERCEL_ENV: "preview" }, { ...vercel, VERCEL_ENV: "production" }]) {
      expect(authUrls(env).trustedOrigins.join(" ")).not.toContain("*");
    }
  });

  test("a missing BETTER_AUTH_URL is an error outside Vercel", () => {
    expect(() => authUrls({})).toThrow(/BETTER_AUTH_URL is not set/);
  });
});
