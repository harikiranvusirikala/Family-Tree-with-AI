import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // separate from `npm run dev` on 3000
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
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
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: { ENABLE_DEV_PAGES: "1" }, // include /dev/* pages in the test build (src/app/dev/layout.tsx)
  },
});
