import { test as base, type Page } from "@playwright/test";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { ObjectId } from "mongodb";
import { authOptions } from "@/server/auth-options";
import { openDatabase } from "@/server/db";

export { expect } from "@playwright/test";

export interface TestUser {
  id: string;
  name: string;
  email: string;
}

interface Fixtures {
  /** Signs `page` in as a brand-new user, created directly in this run's database. */
  signIn: (page: Page, name: string) => Promise<TestUser>;
}

interface WorkerFixtures {
  testHelpers: Awaited<ReturnType<typeof createTestAuth>>;
}

/**
 * The app's own Better Auth settings (same base URL and secret, so the same cookie names and
 * signatures), plus testUtils. testUtils lives only here: the app has no test-login route.
 */
async function createTestAuth(database: Awaited<ReturnType<typeof openDatabase>>) {
  const options = authOptions(database, {
    BETTER_AUTH_URL: process.env.E2E_BASE_URL,
    BETTER_AUTH_SECRET: process.env.E2E_AUTH_SECRET,
    GOOGLE_CLIENT_ID: "unused",
    GOOGLE_CLIENT_SECRET: "unused",
  });
  const auth = betterAuth({
    ...options,
    // validateUserInfo only runs inside a request; testUtils creates users outside one.
    user: {},
    plugins: [testUtils()], // the app's plugins are empty here: no OAuth proxy outside Vercel
  });
  return (await auth.$context).test;
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  testHelpers: [
    async ({}, provide) => {
      const database = await openDatabase(process.env.E2E_MONGODB_DB!);
      try {
        await provide(await createTestAuth(database));
      } finally {
        await database.client.close();
      }
    },
    { scope: "worker" },
  ],

  signIn: async ({ testHelpers }, provide) => {
    await provide(async (page, name) => {
      // A fresh user per call, so parallel tests never share one. Ids are ObjectIds, like real users'.
      const id = new ObjectId().toHexString();
      const email = `${name.toLowerCase().replace(/\W+/g, ".")}.${id.slice(-6)}@example.com`;
      const user = await testHelpers.saveUser(testHelpers.createUser({ id, name, email }));
      await page.context().addCookies(await testHelpers.getCookies({ userId: user.id }));
      return { id: user.id, name: user.name, email: user.email };
    });
  },
});
