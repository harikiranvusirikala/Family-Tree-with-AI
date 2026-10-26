import type { Collection, Db, Filter, ObjectId } from "mongodb";
import { daysAgo, lastDays, pictureKey, shortGroupId, startOfWeek, weeklyCounts, type WeekCount } from "./site-stats-rules";
import { collections } from "./repositories/documents";

const WEEKS = 12;
const CHAT_DAYS = 30;

/** Counts over the last 7 and 30 days. */
export interface Recent {
  week: number;
  month: number;
}

export interface GroupRow {
  /** The last 6 characters of the group's id: the stats never show names. */
  shortId: string;
  createdAt: Date;
  members: number;
  people: number;
  sheets: number;
  /** The latest change to the group, its people, couples or sheets. */
  lastChange: Date;
}

export interface SiteStats {
  totals: {
    users: number;
    groups: number;
    people: number;
    couples: number;
    sheets: number;
    /** People's pictures: each rectangle marked in a shared photo counts, and a photo used whole counts once (pictureKey). */
    photos: number;
    /** The uploaded photos those pictures come from (distinct photoIds). */
    photoFiles: number;
    memberships: number;
  };
  growth: { users: WeekCount[]; groups: WeekCount[] };
  active: { day: number; week: number; month: number };
  building: { peopleAdded: Recent; peopleChanged: Recent; groupsChanged: Recent };
  chat: { days: { day: string; messages: number }[]; people: number; daysAtLimit: number };
  sharing: {
    invites: Record<"pending" | "accepted" | "declined" | "revoked", number>;
    links: number;
    linkJoins: number;
    requests: Record<"pending" | "approved" | "denied", number>;
  };
  groups: GroupRow[];
}

const live = { deletedAt: { $exists: false } };

/**
 * How the site is used (an owner request, 2026-10-25), for the site's owners only (`/admin`; the page
 * checks). Across every group, so it lives outside repositories/ (whose functions all take a groupId). Counts only, worked out from what the database already holds: nothing names a person,
 * an account or a group. Deleted groups, people, couples and sheets are left out, as everywhere.
 */
export async function siteStats(db: Db, { now = new Date(), chatLimit }: { now?: Date; chatLimit: number }): Promise<SiteStats> {
  const { groups, memberships, invites, inviteLinks, accessRequests, users, chatUsage, persons, unions, sheets } = collections(db);
  const since = { day: daysAgo(now, 1), week: daysAgo(now, 7), month: daysAgo(now, 30) };
  const growthFrom = startOfWeek(daysAgo(now, (WEEKS - 1) * 7));
  const chatDays = lastDays(now, CHAT_DAYS);

  const liveGroups = await groups.find(live, { projection: { _id: 1, createdAt: 1, updatedAt: 1 } }).toArray();
  const groupIds = liveGroups.map((g) => g._id);
  const inLiveGroup = { groupId: { $in: groupIds }, ...live };

  const [userCount, people, couples, sheetCount, photos, membershipCount, newUsers, activeIds, chatRows, inviteStatus, links, requestStatus] = await Promise.all([
    users.countDocuments(),
    persons.countDocuments(inLiveGroup),
    unions.countDocuments(inLiveGroup),
    sheets.countDocuments(inLiveGroup),
    persons.find({ ...inLiveGroup, photoId: { $exists: true } }, { projection: { photoId: 1, photoCrop: 1 } }).toArray(),
    memberships.countDocuments({ groupId: { $in: groupIds } }),
    users.find({ createdAt: { $gte: growthFrom } }, { projection: { createdAt: 1 } }).toArray(),
    activeUsers(db, since.month),
    chatUsage.find({ day: { $gte: chatDays[0] } }).toArray(),
    statusCounts(invites, { groupId: { $in: groupIds } }),
    inviteLinks.find({ groupId: { $in: groupIds } }, { projection: { uses: 1 } }).toArray(),
    // Requests for made-up groups are stored too (§8); only real groups count here.
    statusCounts(accessRequests, { groupId: { $in: groupIds } }),
  ]);

  // Deleted people, couples and sheets too: deleting one is a change to its group.
  const inGroup = { groupId: { $in: groupIds } };
  const [personTimes, unionTimes, sheetTimes, memberCounts] = await Promise.all([
    persons.find(inGroup, { projection: { groupId: 1, createdAt: 1, updatedAt: 1, deletedAt: 1 } }).toArray(),
    unions.find(inGroup, { projection: { groupId: 1, updatedAt: 1 } }).toArray(),
    sheets.find(inGroup, { projection: { groupId: 1, updatedAt: 1, deletedAt: 1 } }).toArray(),
    memberships.aggregate<{ _id: ObjectId; count: number }>([{ $match: { groupId: { $in: groupIds } } }, { $group: { _id: "$groupId", count: { $sum: 1 } } }]).toArray(),
  ]);

  const recent = (dates: Date[]): Recent => ({ week: dates.filter((d) => d >= since.week).length, month: dates.filter((d) => d >= since.month).length });
  const livePeople = personTimes.filter((p) => !p.deletedAt);
  const changedGroups = (from: Date) =>
    new Set([...personTimes, ...unionTimes, ...sheetTimes].filter((r) => r.updatedAt >= from).map((r) => r.groupId.toHexString())).size;

  // The groups table: each group's sizes and its latest change.
  const rows = new Map<string, GroupRow>(
    liveGroups.map((g) => [
      g._id.toHexString(),
      { shortId: shortGroupId(g._id.toHexString()), createdAt: g.createdAt, members: 0, people: 0, sheets: 0, lastChange: g.updatedAt ?? g.createdAt },
    ]),
  );
  const touch = (groupId: ObjectId, updatedAt: Date) => {
    const row = rows.get(groupId.toHexString());
    if (row && updatedAt > row.lastChange) row.lastChange = updatedAt;
    return row;
  };
  for (const p of personTimes) {
    const row = touch(p.groupId, p.updatedAt)!;
    if (!p.deletedAt) row.people++;
  }
  for (const u of unionTimes) touch(u.groupId, u.updatedAt);
  for (const s of sheetTimes) {
    const row = touch(s.groupId, s.updatedAt)!;
    if (!s.deletedAt) row.sheets++;
  }
  for (const m of memberCounts) rows.get(m._id.toHexString())!.members = m.count;

  const messages = new Map<string, number>();
  for (const row of chatRows) messages.set(row.day, (messages.get(row.day) ?? 0) + row.count);

  return {
    totals: {
      users: userCount,
      groups: liveGroups.length,
      people,
      couples,
      sheets: sheetCount,
      photos: new Set(photos.map((p) => pictureKey(p.photoId!, p.photoCrop))).size,
      photoFiles: new Set(photos.map((p) => p.photoId)).size,
      memberships: membershipCount,
    },
    growth: { users: weeklyCounts(newUsers.flatMap((u) => (u.createdAt ? [u.createdAt] : [])), now, WEEKS), groups: weeklyCounts(liveGroups.map((g) => g.createdAt), now, WEEKS) },
    active: {
      day: [...activeIds.values()].filter((d) => d >= since.day).length,
      week: [...activeIds.values()].filter((d) => d >= since.week).length,
      month: activeIds.size,
    },
    building: {
      peopleAdded: recent(livePeople.map((p) => p.createdAt)),
      // Changed after being added: an edit, a photo, a move.
      peopleChanged: recent(livePeople.filter((p) => p.updatedAt.getTime() > p.createdAt.getTime()).map((p) => p.updatedAt)),
      groupsChanged: { week: changedGroups(since.week), month: changedGroups(since.month) },
    },
    chat: {
      days: chatDays.map((day) => ({ day, messages: messages.get(day) ?? 0 })),
      people: new Set(chatRows.map((r) => r.userId.toHexString())).size,
      daysAtLimit: chatRows.filter((r) => r.count >= chatLimit).length,
    },
    sharing: {
      invites: { pending: 0, accepted: 0, declined: 0, revoked: 0, ...inviteStatus },
      links: links.length,
      linkJoins: links.reduce((sum, l) => sum + l.uses, 0),
      requests: { pending: 0, approved: 0, denied: 0, ...requestStatus },
    },
    groups: [...rows.values()].sort((a, b) => b.lastChange.getTime() - a.lastChange.getTime()),
  };
}

/**
 * Each user who used the site since `from`, with the latest time: a session renewed (Better Auth
 * renews a session's `updatedAt` at most once a day while it's used) or a sign-in (the Google
 * account's `updatedAt`). Sessions last 30 days, so this is close, not exact.
 */
async function activeUsers(db: Db, from: Date): Promise<Map<string, Date>> {
  const latest = new Map<string, Date>();
  for (const name of ["sessions", "accounts"]) {
    const rows = await db
      .collection(name)
      .aggregate<{ _id: ObjectId | string; at: Date }>([{ $match: { updatedAt: { $gte: from } } }, { $group: { _id: "$userId", at: { $max: "$updatedAt" } } }])
      .toArray();
    for (const { _id, at } of rows) {
      const id = String(_id);
      if (!latest.has(id) || at > latest.get(id)!) latest.set(id, at);
    }
  }
  return latest;
}

/** How many records have each status. */
async function statusCounts<T extends { status: string }>(collection: Collection<T>, filter: Filter<T>): Promise<Record<string, number>> {
  const rows = await collection.aggregate<{ _id: string; count: number }>([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}
