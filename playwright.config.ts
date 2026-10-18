import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // separate from `npm run dev` on 3000
const isCI = !!process.env.CI;

if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // MONGODB_URI; never overrides existing values
// One throwaway database per run: seeded by e2e/global-setup.ts, dropped by e2e/global-teardown.ts.
// Set here so the test workers and the web server all see the same name.
process.env.E2E_MONGODB_DB ??= `familytree_test_${Date.now().toString(36)}_e2e`; // format: test/db.ts
// Sign-in settings shared by the web server and the signIn fixture (e2e/fixtures.ts), whose cookies
// the server must accept. A fresh secret per run: `next start` refuses Better Auth's default, and CI has none.
process.env.E2E_BASE_URL ??= `http://localhost:${PORT}`;
process.env.E2E_AUTH_SECRET ??= randomBytes(32).toString("base64");

export default defineConfig({
  testDir: "./e2e",
  // Every save is a transaction plus a re-render against the remote Atlas M0 cluster: 1–5 s from a
  // laptop far from it, with four workers sharing it.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Locally, use the installed Google Chrome (Playwright's own browser download
        // is blocked on some networks). CI installs Playwright's Chromium.
        channel: isCI ? undefined : "chrome",
      },
    },
  ],
  // Test against a production build, as the Next.js testing guide recommends.
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: process.env.E2E_BASE_URL,
    reuseExistingServer: false, // a running server would point at another database
    timeout: 180_000,
    env: {
      ENABLE_DEV_PAGES: "1", // include /dev/* pages in the test build (src/app/dev/layout.tsx)
      MONGODB_DB: process.env.E2E_MONGODB_DB,
      // Otherwise .env.local's port 3000 leaks in, and Better Auth rejects requests from port 3100.
      BETTER_AUTH_URL: process.env.E2E_BASE_URL,
      BETTER_AUTH_SECRET: process.env.E2E_AUTH_SECRET,
      // Placeholders: the tests stop at the redirect to Google and never contact it.
      GOOGLE_CLIENT_ID: "e2e-placeholder.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "e2e-placeholder",
    },
  },
});
