import { test as base, expect, type Page } from "@playwright/test";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { ObjectId } from "mongodb";
import { authOptions } from "@/server/auth-options";
import { openDatabase, type Database } from "@/server/db";
import { operationsFromFamily } from "@/server/operations/from-family";
import { collections } from "@/server/repositories/documents";
import { createGroup } from "@/server/repositories/groups";
import type { Role } from "@/server/roles";
import { cruzYoung, inLawParentIds } from "@test/fixtures/cruz-young";
import { watchPolicyViolations } from "./policy-violations";

export { expect } from "@playwright/test";

export interface TestUser {
  id: string;
  name: string;
  email: string;
}

interface Fixtures {
  /** Signs `page` in as a brand-new user, created directly in this run's database; `image`: their Google photo's address. */
  signIn: (page: Page, name: string, options?: { image?: string }) => Promise<TestUser>;
  /** A group owned by `owner` holding the sample family, with its "Cruz family" and "Jerry Willow's family" sheets. */
  sampleGroup: (owner: TestUser) => Promise<{ groupId: string; cruzSheet: string; jerrySheet: string }>;
  /** Gives a user a role in a group directly (until step 8 adds invites). */
  addMember: (groupId: string, user: TestUser, role: Role) => Promise<void>;
  /**
   * Content Security Policy violations on the test's pages (`page`, and any page given to signIn).
   * Every test fails if there are any, so the tests check the policy blocks nothing the app uses.
   */
  policyViolations: string[];
}

export type SignIn = Fixtures["signIn"];
export type SampleGroup = Fixtures["sampleGroup"];

interface WorkerFixtures {
  database: Database;
  testHelpers: Awaited<ReturnType<typeof createTestAuth>>;
}

/**
 * The app's own Better Auth settings (same base URL and secret, so the same cookie names and
 * signatures), plus testUtils. testUtils lives only here: the app has no test-login route.
 */
async function createTestAuth(database: Database) {
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
  policyViolations: [
    async ({}, provide) => {
      const violations: string[] = [];
      await provide(violations);
      expect(violations, "Content Security Policy violations").toEqual([]);
    },
    { auto: true },
  ],

  page: async ({ page, policyViolations }, provide) => {
    watchPolicyViolations(page, policyViolations);
    await provide(page);
  },

  database: [
    async ({}, provide) => {
      const database = await openDatabase(process.env.E2E_MONGODB_DB!);
      try {
        await provide(database);
      } finally {
        await database.client.close();
      }
    },
    { scope: "worker" },
  ],

  testHelpers: [async ({ database }, provide) => provide(await createTestAuth(database)), { scope: "worker" }],

  sampleGroup: async ({ database }, provide) => {
    await provide(async (owner) => {
      const ops = operationsFromFamily(cruzYoung, [
        { title: "Cruz family", rootPersonId: "alexander-cruz", extraPersonIds: inLawParentIds, pinned: true },
        { title: "Jerry Willow's family", rootPersonId: "jerry-willow", pinned: true },
      ]);
      const { groupId, idMap } = await createGroup(database, "Cruz family", ops, owner.id);
      return { groupId, cruzSheet: idMap["new:sheet-0"], jerrySheet: idMap["new:sheet-1"] };
    });
  },

  addMember: async ({ database }, provide) => {
    await provide(async (groupId, user, role) => {
      await collections(database.db).memberships.insertOne({
        _id: new ObjectId(),
        groupId: new ObjectId(groupId),
        userId: new ObjectId(user.id),
        role,
        addedBy: "e2e",
        createdAt: new Date(),
      });
    });
  },

  signIn: async ({ testHelpers, policyViolations }, provide) => {
    await provide(async (page, name, { image } = {}) => {
      watchPolicyViolations(page, policyViolations); // also pages a test opens itself
      // A fresh user per call, so parallel tests never share one. Ids are ObjectIds, like real users'.
      const id = new ObjectId().toHexString();
      const email = `${name.toLowerCase().replace(/\W+/g, ".")}.${id.slice(-6)}@example.com`;
      const user = await testHelpers.saveUser(testHelpers.createUser({ id, name, email, image }));
      await page.context().addCookies(await testHelpers.getCookies({ userId: user.id }));
      return { id: user.id, name: user.name, email: user.email };
    });
  },
});
