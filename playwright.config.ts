import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // separate from `npm run dev` on 3000
const CLOUDINARY_STUB_PORT = 3101;
const MODEL_STUB_PORT = 3102;
const isCI = !!process.env.CI;

if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // MONGODB_URI; never overrides existing values
// One throwaway database per run: seeded by e2e/global-setup.ts, dropped by e2e/global-teardown.ts.
// Set here so the test workers and the web server all see the same name.
process.env.E2E_MONGODB_DB ??= `familytree_test_${Date.now().toString(36)}_e2e`; // format: test/db.ts
// Sign-in settings shared by the web server and the signIn fixture (e2e/fixtures.ts), whose cookies
// the server must accept. A fresh secret per run: `next start` refuses Better Auth's default, and CI has none.
process.env.E2E_BASE_URL ??= `http://localhost:${PORT}`;
process.env.E2E_AUTH_SECRET ??= randomBytes(32).toString("base64");
// Photos go to a stand-in for Cloudinary's API (e2e/cloudinary-stub.mts), never to Cloudinary. These
// placeholders override any real CLOUDINARY_* values from .env.local.
process.env.E2E_CLOUDINARY_URL ??= `http://localhost:${CLOUDINARY_STUB_PORT}`;
const cloudinary = { CLOUDINARY_API_KEY: "123456789012345", CLOUDINARY_API_SECRET: "e2e-placeholder-secret" };
// The AI chat talks to a stand-in for the Messages API (e2e/model-stub.mts), never to Anthropic. The
// ANTHROPIC_* variables a Claude Code session sets (its gateway) are cleared for the app.
process.env.E2E_MODEL_URL ??= `http://localhost:${MODEL_STUB_PORT}`;
const chatKey = { CHAT_API_KEY: "e2e-placeholder-key" };

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
  webServer: [
    {
      // Test against a production build, as the Next.js testing guide recommends.
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
        GOOGLE_CLIENT_SECRET: "e2e-google-placeholder-secret", // e2e/security.spec.ts checks no secret reaches the browser
        // Uploads and deletes go to the stand-in; tests answer photo URLs (res.cloudinary.com/e2e-cloud) themselves.
        CLOUDINARY_CLOUD_NAME: "e2e-cloud",
        ...cloudinary,
        CLOUDINARY_API_URL: process.env.E2E_CLOUDINARY_URL,
        ...chatKey,
        CHAT_API_URL: process.env.E2E_MODEL_URL,
        CHAT_MODEL: "claude-haiku-5-5",
        CHAT_DAILY_LIMIT: "1000",
        ANTHROPIC_BASE_URL: "",
        ANTHROPIC_CUSTOM_HEADERS: "",
        ANTHROPIC_API_KEY: "",
        ANTHROPIC_AUTH_TOKEN: "",
      },
    },
    {
      command: "node --import tsx e2e/cloudinary-stub.mts",
      url: process.env.E2E_CLOUDINARY_URL,
      reuseExistingServer: false,
      env: { PORT: String(CLOUDINARY_STUB_PORT), ...cloudinary },
    },
    {
      command: "node --import tsx e2e/model-stub.mts",
      url: process.env.E2E_MODEL_URL,
      reuseExistingServer: false,
      env: { PORT: String(MODEL_STUB_PORT), ...chatKey },
    },
  ],
});
