import type { Db, ObjectId } from "mongodb";
import type { Database } from "../db";
import { InvalidIdError, toObjectId } from "../ids";
import { leaveProblem, memberChangeProblem, MemberError, transferProblem, type GrantableRole } from "../members-rules";
import { MIN_ROLE, RANK, type Role } from "../roles";
import { collections } from "./documents";
import { roleInGroup } from "./groups";

export interface MemberSummary {
  userId: string;
  name: string;
  email: string;
  /** Their Google photo's address, or null (shown through googlePhotoUrl). */
  image: string | null;
  role: Role;
  joinedAt: Date;
  /** Joined by an invite link (an owner request, 2026-10-24). */
  byLink: boolean;
}

/**
 * How many members each group has, for the dashboard's group cards. Only counts: the caller passes its
 * user's own groups, and who the members are stays on the members page (Admin and up).
 */
export async function memberCounts(db: Db, groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const counts = await collections(db)
    .memberships.aggregate<{ _id: ObjectId; count: number }>([
      { $match: { groupId: { $in: groupIds.map(toObjectId) } } },
      { $group: { _id: "$groupId", count: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(counts.map((c) => [c._id.toHexString(), c.count]));
}

/** Everyone in the group: the Owner first, then by role and name. For the members page (Admin and up). */
export async function listMembers(db: Db, groupId: string): Promise<MemberSummary[]> {
  const { memberships, users } = collections(db);
  const members = await memberships.find({ groupId: toObjectId(groupId) }).toArray();
  const found = await users.find({ _id: { $in: members.map((m) => m.userId) } }, { projection: { name: 1, email: 1, image: 1 } }).toArray();
  const byId = new Map(found.map((u) => [u._id.toHexString(), u]));
  return members
    .map((m) => {
      const user = byId.get(m.userId.toHexString());
      return { userId: m.userId.toHexString(), name: user?.name ?? "Unknown user", email: user?.email ?? "", image: user?.image ?? null, role: m.role, joinedAt: m.createdAt, byLink: m.inviteLinkId !== undefined };
    })
    .sort((a, b) => RANK[b.role] - RANK[a.role] || a.name.localeCompare(b.name));
}

async function membershipOf(db: Db, groupId: ObjectId, userId: string) {
  let uid;
  try {
    uid = toObjectId(userId);
  } catch (error) {
    if (error instanceof InvalidIdError) throw new MemberError("They aren't a member of this group.");
    throw error;
  }
  const membership = await collections(db).memberships.findOne({ groupId, userId: uid });
  if (!membership) throw new MemberError("They aren't a member of this group.");
  return membership;
}

/** Admin and up give a member another role (up to Admin). Never the Owner's. */
export async function changeRole(db: Db, groupId: string, actorId: string, userId: string, role: GrantableRole): Promise<void> {
  const actor = await roleInGroup(db, groupId, actorId, MIN_ROLE.manageMembers);
  const target = await membershipOf(db, toObjectId(groupId), userId);
  const problem = memberChangeProblem(actor.role, target.role, role);
  if (problem) throw new MemberError(problem);
  // `role: {$ne: "owner"}`: they can't have become the Owner meanwhile.
  await collections(db).memberships.updateOne({ _id: target._id, role: { $ne: "owner" } }, { $set: { role } });
}

/** Admin and up remove a member. Never the Owner. It takes effect on their next request (§8). */
export async function removeMember(db: Db, groupId: string, actorId: string, userId: string): Promise<void> {
  const actor = await roleInGroup(db, groupId, actorId, MIN_ROLE.manageMembers);
  const target = await membershipOf(db, toObjectId(groupId), userId);
  const problem = memberChangeProblem(actor.role, target.role, "remove");
  if (problem) throw new MemberError(problem);
  await collections(db).memberships.deleteOne({ _id: target._id, role: { $ne: "owner" } });
}

/** Anyone but the Owner can leave a group. */
export async function leaveGroup(db: Db, groupId: string, userId: string): Promise<void> {
  const { role } = await roleInGroup(db, groupId, userId, MIN_ROLE.viewTree);
  const problem = leaveProblem(role);
  if (problem) throw new MemberError(problem);
  await collections(db).memberships.deleteOne({ groupId: toObjectId(groupId), userId: toObjectId(userId), role: { $ne: "owner" } });
}

/** The Owner hands ownership to another member and becomes an Admin, in one transaction: always exactly one Owner. */
export async function transferOwnership(database: Database, groupId: string, ownerId: string, userId: string): Promise<void> {
  const actor = await roleInGroup(database.db, groupId, ownerId, MIN_ROLE.transferOwnership);
  const gid = toObjectId(groupId);
  const target = await membershipOf(database.db, gid, userId);
  const problem = transferProblem(actor.role, target.role, target.userId.toHexString() === ownerId);
  if (problem) throw new MemberError(problem);
  const { memberships } = collections(database.db);
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const demoted = await memberships.updateOne({ groupId: gid, userId: toObjectId(ownerId), role: "owner" }, { $set: { role: "admin" } }, { session });
      const promoted = await memberships.updateOne({ _id: target._id, role: { $ne: "owner" } }, { $set: { role: "owner" } }, { session });
      if (demoted.modifiedCount !== 1 || promoted.modifiedCount !== 1) throw new MemberError("Ownership changed meanwhile. Reload and try again.");
    });
  } finally {
    await session.endSession();
  }
}
