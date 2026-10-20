import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

/**
 * The production smoke test (step 11): `npm run test:smoke`, and after every production deployment
 * (.github/workflows/smoke.yml). Only what a signed-out visitor can do, so it never signs in or
 * writes anything. SMOKE_URL points it elsewhere.
 */
export default defineConfig({
  testDir: "./smoke",
  timeout: 30_000,
  // On CI, retries cover the moment between Vercel reporting the deployment and the domain moving to it.
  retries: isCI ? 2 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.SMOKE_URL ?? "https://family-tree-with-ai.vercel.app",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: isCI ? undefined : "chrome" } }],
});
