import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestDatabase } from "@test/db";
import { ensureIndexes, RETIRED_INDEXES } from "./documents";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.drop();
});

/** Each index of a collection as "key[ unique][ ttl]", e.g. "token_1 unique". */
async function indexes(collection: string): Promise<string[]> {
  const found = await database.db.collection(collection).listIndexes().toArray();
  return found
    .filter((i) => i.name !== "_id_")
    .map((i) => [i.name, i.unique && "unique", i.expireAfterSeconds !== undefined && "ttl"].filter(Boolean).join(" "))
    .sort();
}

describe("ensureIndexes (npm run db:setup)", () => {
  test("drops the retired couple indexes, and runs again without error", async () => {
    const unions = database.db.collection("unions");
    await unions.createIndex({ groupId: 1, partnerIds: 1 }); // as an older db:setup made them
    await unions.createIndex({ groupId: 1, childIds: 1 });
    await ensureIndexes(database.db);
    await ensureIndexes(database.db); // already in place, already dropped
    expect(await indexes("unions")).toEqual(["groupId_1"]);
    expect(RETIRED_INDEXES.map((i) => i.name)).toEqual(["groupId_1_partnerIds_1", "groupId_1_childIds_1"]);
  });

  test("Better Auth's lookups are indexed (an owner request: its Mongo adapter creates none)", async () => {
    expect(await indexes("sessions")).toEqual(["expiresAt_1 ttl", "token_1 unique", "userId_1"]);
    expect(await indexes("users")).toEqual(["email_1 unique"]);
    expect(await indexes("accounts")).toEqual(["providerId_1_accountId_1", "userId_1"]);
    expect(await indexes("verifications")).toEqual(["expiresAt_1 ttl", "identifier_1"]);
  });

  test("the app's own, as before", async () => {
    expect(await indexes("memberships")).toEqual(["groupId_1_userId_1 unique", "userId_1"]);
    expect(await indexes("invites")).toEqual(["emailNormalized_1_status_1", "groupId_1_emailNormalized_1 unique", "groupId_1_status_1", "token_1 unique"]);
    expect(await indexes("chatUsage")).toEqual(["expiresAt_1 ttl", "userId_1_day_1 unique"]);
    for (const collection of ["persons", "sheets"]) expect(await indexes(collection)).toEqual(["groupId_1"]);
  });

  test("two users can't share an email", async () => {
    const users = database.db.collection("users");
    await users.insertOne({ email: "asha@example.com", name: "Asha" });
    await expect(users.insertOne({ email: "asha@example.com", name: "Asha again" })).rejects.toMatchObject({ code: 11000 });
  });
});
