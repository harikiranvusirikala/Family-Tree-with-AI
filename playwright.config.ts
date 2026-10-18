import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // separate from `npm run dev` on 3000
const isCI = !!process.env.CI;

if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // MONGODB_URI; never overrides existing values
// One throwaway database per run: seeded by e2e/global-setup.ts, dropped by e2e/global-teardown.ts.
// Set here so the test workers and the web server all see the same name.
process.env.E2E_MONGODB_DB ??= `familytree_test_${Date.now().toString(36)}_e2e`; // format: test/db.ts

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
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
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false, // a running server would point at another database
    timeout: 180_000,
    env: {
      ENABLE_DEV_PAGES: "1", // include /dev/* pages in the test build (src/app/dev/layout.tsx)
      MONGODB_DB: process.env.E2E_MONGODB_DB,
    },
  },
});
