import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Integration tests against MongoDB Atlas: `npm run test:db`. Each test file creates its own
// throwaway familytree_test_<run-id> database (test/db.ts) and drops it afterwards.
if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // MONGODB_URI; never overrides existing values

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts", "test/**/*.db.test.ts"],
    globalSetup: ["test/db-global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
