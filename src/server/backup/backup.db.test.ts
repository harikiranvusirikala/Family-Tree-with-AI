import { BSON, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { operationsFromFamily } from "@/server/operations/from-family";
import { countChatMessage } from "@/server/repositories/chat-usage";
import { ensureIndexes } from "@/server/repositories/documents";
import { createGroup } from "@/server/repositories/groups";
import { createInvite } from "@/server/repositories/invites";
import { createTestDatabase } from "@test/db";
import { cruzYoung } from "@test/fixtures/cruz-young";
import { backupDatabase, restoreDatabase } from "./archive";
import { decrypt, encrypt } from "./crypt";

let source: Awaited<ReturnType<typeof createTestDatabase>>;
let target: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  [source, target] = await Promise.all([createTestDatabase(), createTestDatabase()]);
  await ensureIndexes(source.db);
});
afterAll(async () => {
  await Promise.all([source?.drop(), target?.drop()]);
});

const key = Buffer.alloc(32, 3);
const canonical = (value: unknown) => BSON.EJSON.stringify(value, { relaxed: false });
const everything = async (db: Db, name: string) => canonical(await db.collection(name).find({}, { sort: { _id: 1 } }).toArray());
const indexes = async (db: Db, name: string) => (await db.collection(name).listIndexes().toArray()).sort((a, b) => a.name.localeCompare(b.name));

describe("nightly backup and restore against MongoDB (F12)", () => {
  test("a group with its members, invites, users and chat usage comes back exactly, without sign-in leftovers", async () => {
    const owner = new ObjectId();
    await source.db.collection("users").insertOne({ _id: owner, name: "Carla Cruz", email: "carla@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
    const ops = operationsFromFamily(cruzYoung, [{ title: "Cruz family", rootPersonId: "alexander-cruz", pinned: true }]);
    const { groupId } = await createGroup(source, "Cruz family", ops, owner.toHexString());
    await createInvite(source.db, groupId, owner.toHexString(), { email: "jake@example.com", role: "maintain" });
    await countChatMessage(source.db, owner.toHexString(), 50);
    await source.db.collection("sessions").insertOne({ token: "secret", userId: owner, expiresAt: new Date(Date.now() + 86_400_000) });
    await source.db.collection("verifications").insertOne({ identifier: "state", value: "x", expiresAt: new Date(Date.now() + 600_000) });

    const file = encrypt((await backupDatabase(source.db)).data, key);
    const header = await restoreDatabase(target.db, decrypt(file, key));

    const restored = Object.keys(header.collections);
    expect(restored).toEqual(["accessRequests", "chatUsage", "groups", "invites", "memberships", "persons", "sheets", "unions", "users"]);
    expect(header.collections.persons.count).toBe(36);
    for (const name of restored) {
      expect(await everything(target.db, name), name).toBe(await everything(source.db, name));
      expect(await indexes(target.db, name), name).toEqual(await indexes(source.db, name));
    }
    const targetNames = (await target.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    expect(targetNames).not.toContain("sessions");
    expect(targetNames).not.toContain("verifications");
  });

  test("restoring over existing records is refused unless replacing", async () => {
    const { data } = await backupDatabase(source.db);
    await expect(restoreDatabase(target.db, data)).rejects.toThrow(/already has records in .*persons.*add --replace to replace them/);

    await target.db.collection("persons").deleteMany({ name: "Jake Cruz" }); // a change the restore must undo
    await restoreDatabase(target.db, data, { replace: true });
    expect(await everything(target.db, "persons")).toBe(await everything(source.db, "persons"));
  });
});
