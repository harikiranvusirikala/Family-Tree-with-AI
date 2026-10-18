import { ObjectId, type Db } from "mongodb";
import type { Database } from "../db";
import { InvalidIdError, toObjectId } from "../ids";
import { applyInTransaction, parseOperations, type ApplyResult } from "../operations/apply";
import { hasRole, NoAccessError, type Role } from "../roles";
import { collections } from "./documents";

export interface GroupSummary {
  id: string;
  name: string;
  role: Role;
}

/** Ids from a URL or a form: anything malformed is simply "no access". */
function ids(groupId: string, userId: string) {
  try {
    return { gid: toObjectId(groupId), uid: toObjectId(userId) };
  } catch (error) {
    if (error instanceof InvalidIdError) throw new NoAccessError();
    throw error;
  }
}

/**
 * The user's role in a group, if it is at least `min`. Otherwise NoAccessError, the same for a group
 * that doesn't exist, was deleted, or that they aren't in (§8). Read from the database every time.
 */
export async function roleInGroup(db: Db, groupId: string, userId: string, min: Role) {
  const { gid, uid } = ids(groupId, userId);
  const { groups, memberships } = collections(db);
  const [membership, group] = await Promise.all([
    memberships.findOne({ groupId: gid, userId: uid }),
    groups.findOne({ _id: gid, deletedAt: { $exists: false } }),
  ]);
  if (!membership || !group || !hasRole(membership.role, min)) throw new NoAccessError();
  return { role: membership.role, group: { id: gid.toHexString(), name: group.name } };
}

/**
 * F2: the group, its owner membership and its first records (`operations`, e.g. the parents and two
 * pinned sheets), all in one transaction. A batch that fails validation leaves nothing behind.
 */
export async function createGroup(
  database: Database,
  name: string,
  operations: unknown,
  userId: string,
): Promise<ApplyResult & { groupId: string }> {
  const ops = parseOperations(operations);
  const uid = toObjectId(userId);
  const gid = new ObjectId();
  const { groups, memberships } = collections(database.db);
  const session = database.client.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const now = new Date();
      await groups.insertOne({ _id: gid, name, createdBy: userId, createdAt: now, updatedBy: userId, updatedAt: now }, { session });
      await memberships.insertOne({ _id: new ObjectId(), groupId: gid, userId: uid, role: "owner", addedBy: userId, createdAt: now }, { session });
      return applyInTransaction(database.db, gid, ops, userId, session);
    });
    return { ...result, groupId: gid.toHexString() };
  } finally {
    await session.endSession();
  }
}

/** The dashboard: every group the user belongs to, with their role, by name. */
export async function listGroupsForUser(db: Db, userId: string): Promise<GroupSummary[]> {
  const { groups, memberships } = collections(db);
  const mine = await memberships.find({ userId: toObjectId(userId) }).toArray();
  const roleOf = new Map(mine.map((m) => [m.groupId.toHexString(), m.role]));
  const found = await groups.find({ _id: { $in: mine.map((m) => m.groupId) }, deletedAt: { $exists: false } }).toArray();
  return found
    .map((g) => ({ id: g._id.toHexString(), name: g.name, role: roleOf.get(g._id.toHexString())! }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The sheet a group link opens: the first pinned sheet, else the first sheet. */
export async function firstSheetId(db: Db, groupId: string): Promise<string | undefined> {
  const sheet = await collections(db).sheets.findOne({ groupId: toObjectId(groupId) }, { sort: { pinned: -1, order: 1 }, projection: { _id: 1 } });
  return sheet?._id.toHexString();
}

export async function renameGroup(db: Db, groupId: string, name: string, actor: string): Promise<void> {
  await collections(db).groups.updateOne(
    { _id: toObjectId(groupId), deletedAt: { $exists: false } },
    { $set: { name, updatedBy: actor, updatedAt: new Date() } },
  );
}

/** A soft delete: the group disappears for everyone, and its records stay in the database. */
export async function deleteGroup(db: Db, groupId: string, actor: string): Promise<void> {
  const now = new Date();
  await collections(db).groups.updateOne(
    { _id: toObjectId(groupId), deletedAt: { $exists: false } },
    { $set: { deletedAt: now, updatedBy: actor, updatedAt: now } },
  );
}
