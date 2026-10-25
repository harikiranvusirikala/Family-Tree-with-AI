import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestDatabase } from "@test/db";
import { collections } from "./repositories/documents";
import { siteStats } from "./site-stats";

// Sunday 25 October 2026; the stats' windows count back from here.
const now = new Date("2026-10-25T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

let database: Awaited<ReturnType<typeof createTestDatabase>>;
const live = new ObjectId();
const quiet = new ObjectId();
const deleted = new ObjectId();
const [asha, ben, chen] = [new ObjectId(), new ObjectId(), new ObjectId()];

const audit = (createdAt: Date, updatedAt = createdAt) => ({ createdBy: "x", createdAt, updatedBy: "x", updatedAt });
const person = (groupId: ObjectId, createdAt: Date, updatedAt?: Date, extra: object = {}) => ({
  _id: new ObjectId(),
  groupId,
  name: "Someone",
  gender: "female" as const,
  ...audit(createdAt, updatedAt),
  ...extra,
});

beforeAll(async () => {
  database = await createTestDatabase();
  const { db } = database;
  const c = collections(db);
  await c.users.insertMany([
    { _id: asha, name: "Asha", email: "asha@example.com", createdAt: ago(2) },
    { _id: ben, name: "Ben", email: "ben@example.com", createdAt: ago(40) },
    { _id: chen, name: "Chen", email: "chen@example.com", createdAt: ago(200) },
  ]);
  await c.groups.insertMany([
    { _id: live, name: "Cruz", ...audit(ago(40), ago(40)) },
    { _id: quiet, name: "Young", ...audit(ago(100), ago(100)) },
    { _id: deleted, name: "Gone", ...audit(ago(3)), deletedAt: ago(1) },
  ]);
  await c.memberships.insertMany([
    { _id: new ObjectId(), groupId: live, userId: asha, role: "owner", addedBy: "x", createdAt: ago(40) },
    { _id: new ObjectId(), groupId: live, userId: ben, role: "view", addedBy: "x", createdAt: ago(10), inviteLinkId: new ObjectId() },
    { _id: new ObjectId(), groupId: quiet, userId: chen, role: "owner", addedBy: "x", createdAt: ago(100) },
    { _id: new ObjectId(), groupId: deleted, userId: chen, role: "owner", addedBy: "x", createdAt: ago(3) },
  ]);
  await c.persons.insertMany([
    person(live, ago(2), ago(2), { photoId: `groups/${live}/a` }), // added this week
    person(live, ago(20), ago(3), { photoId: `groups/${live}/a` }), // added this month, changed this week; the same photo
    person(live, ago(60), ago(1), { photoId: `groups/${live}/b` }), // changed yesterday: the group's last change
    person(live, ago(60), ago(1), { deletedAt: ago(1) }), // deleted: not counted
    person(quiet, ago(100)),
    person(deleted, ago(3), ago(3), { photoId: `groups/${deleted}/c` }), // in a deleted group
  ]);
  await c.unions.insertOne({ _id: new ObjectId(), groupId: live, partnerIds: [], childIds: [], status: "married", ...audit(ago(60)) });
  await c.sheets.insertMany([
    { _id: new ObjectId(), groupId: live, title: "Cruz", rootPersonId: new ObjectId(), pinned: true, order: 0, extraPersonIds: [], ...audit(ago(40)) },
    { _id: new ObjectId(), groupId: quiet, title: "Young", rootPersonId: new ObjectId(), pinned: true, order: 0, extraPersonIds: [], ...audit(ago(100)) },
  ]);
  await c.chatUsage.insertMany([
    { _id: new ObjectId(), userId: asha, day: "2026-10-25", count: 3, expiresAt: ago(-30) },
    { _id: new ObjectId(), userId: ben, day: "2026-10-25", count: 5, expiresAt: ago(-30) }, // at the limit of 5
    { _id: new ObjectId(), userId: asha, day: "2026-10-20", count: 1, expiresAt: ago(-30) },
  ]);
  const invite = { email: "e@example.com", emailNormalized: "e@example.com", role: "view" as const, invitedBy: "x", expiresAt: ago(-7), createdAt: ago(5) };
  await c.invites.insertMany([
    { _id: new ObjectId(), groupId: live, token: "t1", status: "accepted", ...invite },
    { _id: new ObjectId(), groupId: live, token: "t2", status: "pending", ...invite },
    { _id: new ObjectId(), groupId: deleted, token: "t3", status: "pending", ...invite }, // a deleted group's
  ]);
  await c.inviteLinks.insertOne({ _id: new ObjectId(), groupId: live, role: "view", token: "l1", createdBy: "x", createdAt: ago(10), expiresAt: ago(-20), uses: 2, status: "active" });
  await c.accessRequests.insertMany([
    { _id: new ObjectId(), groupId: live, userId: chen, email: "chen@example.com", status: "denied", createdAt: ago(5) },
    { _id: new ObjectId(), groupId: new ObjectId(), userId: chen, email: "chen@example.com", status: "pending", createdAt: ago(5) }, // a made-up group
  ]);
  // Asha used the site an hour ago; Ben signed in 5 days ago; Chen's session is older than 30 days.
  await db.collection("sessions").insertMany([
    { userId: asha, token: "s1", createdAt: ago(10), updatedAt: ago(1 / 24), expiresAt: ago(-20) },
    { userId: chen, token: "s2", createdAt: ago(45), updatedAt: ago(45), expiresAt: ago(-1) },
  ]);
  await db.collection("accounts").insertMany([
    { userId: ben, providerId: "google", accountId: "b", createdAt: ago(40), updatedAt: ago(5) },
    { userId: asha, providerId: "google", accountId: "a", createdAt: ago(2), updatedAt: ago(2) },
  ]);
});
afterAll(async () => {
  await database?.drop();
});

describe("the site stats (an owner request)", () => {
  test("totals leave out deleted groups, people and what's in deleted groups; photos are counted once", async () => {
    const { totals } = await siteStats(database.db, { now, chatLimit: 5 });
    expect(totals).toEqual({ users: 3, groups: 2, people: 4, couples: 1, sheets: 2, photos: 2, memberships: 3 });
  });

  test("new users and groups by week, this week last", async () => {
    const { growth } = await siteStats(database.db, { now, chatLimit: 5 });
    expect(growth.users).toHaveLength(12);
    expect(growth.users.at(-1)).toEqual({ week: "2026-10-19", count: 1 }); // Asha; Chen is too old for the chart
    expect(growth.users.reduce((sum, w) => sum + w.count, 0)).toBe(2);
    expect(growth.groups.reduce((sum, w) => sum + w.count, 0)).toBe(1); // Cruz; Young is too old for the chart, the deleted group isn't counted
  });

  test("active people by their latest session or sign-in", async () => {
    const { active } = await siteStats(database.db, { now, chatLimit: 5 });
    expect(active).toEqual({ day: 1, week: 2, month: 2 });
  });

  test("building: people added and changed, and groups changed, over 7 and 30 days", async () => {
    const { building } = await siteStats(database.db, { now, chatLimit: 5 });
    expect(building).toEqual({
      peopleAdded: { week: 1, month: 2 },
      peopleChanged: { week: 2, month: 2 },
      groupsChanged: { week: 1, month: 1 },
    });
  });

  test("the assistant: messages per day, who used it, days at the limit", async () => {
    const { chat } = await siteStats(database.db, { now, chatLimit: 5 });
    expect(chat.days).toHaveLength(30);
    expect(chat.days.at(-1)).toEqual({ day: "2026-10-25", messages: 8 });
    expect(chat.days.find((d) => d.day === "2026-10-20")).toEqual({ day: "2026-10-20", messages: 1 });
    expect(chat.people).toBe(2);
    expect(chat.daysAtLimit).toBe(1);
  });

  test("sharing counts only groups that exist", async () => {
    const { sharing } = await siteStats(database.db, { now, chatLimit: 5 });
    expect(sharing).toEqual({
      invites: { pending: 1, accepted: 1, declined: 0, revoked: 0 },
      links: 1,
      linkJoins: 2,
      requests: { pending: 0, approved: 0, denied: 1 },
    });
  });

  test("the groups table: short ids, sizes and the last change, most recent first, without names", async () => {
    const { groups } = await siteStats(database.db, { now, chatLimit: 5 });
    expect(groups).toEqual([
      { shortId: live.toHexString().slice(-6), createdAt: ago(40), members: 2, people: 3, sheets: 1, lastChange: ago(1) },
      { shortId: quiet.toHexString().slice(-6), createdAt: ago(100), members: 1, people: 1, sheets: 1, lastChange: ago(100) },
    ]);
    expect(JSON.stringify(groups)).not.toMatch(/Cruz|Young/);
  });
});
