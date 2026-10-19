import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestDatabase } from "@test/db";
import { countChatMessage } from "./chat-usage";
import { collections, ensureIndexes } from "./documents";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  database = await createTestDatabase();
  await ensureIndexes(database.db);
});
afterAll(async () => {
  await database?.drop();
});

describe("the chat's daily cap (F7)", () => {
  test("messages sent at once can't slip past the limit, and the 4th of 3 is refused", async () => {
    const user = new ObjectId().toHexString();
    const day = new Date("2026-10-19T09:00:00Z");
    const results = await Promise.all(Array.from({ length: 5 }, () => countChatMessage(database.db, user, 3, day)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await countChatMessage(database.db, user, 3, day)).toBe(false);
    const row = await collections(database.db).chatUsage.findOne({ userId: new ObjectId(user), day: "2026-10-19" });
    expect(row).toMatchObject({ count: 3 });
    expect(row!.expiresAt.getTime() - day.getTime()).toBe(30 * 86_400_000);
  });

  test("each day (UTC) and each person counts separately", async () => {
    const user = new ObjectId().toHexString();
    expect(await countChatMessage(database.db, user, 1, new Date("2026-10-19T23:59:00Z"))).toBe(true);
    expect(await countChatMessage(database.db, user, 1, new Date("2026-10-19T23:59:30Z"))).toBe(false);
    expect(await countChatMessage(database.db, user, 1, new Date("2026-10-20T00:00:10Z"))).toBe(true);
    expect(await countChatMessage(database.db, new ObjectId().toHexString(), 1, new Date("2026-10-19T23:59:30Z"))).toBe(true);
  });
});
