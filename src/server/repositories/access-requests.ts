import { ObjectId, type Db } from "mongodb";
import type { Database } from "../db";
import { InvalidIdError, toObjectId } from "../ids";
import { MemberError, normalizeEmail, type GrantableRole } from "../members-rules";
import { MIN_ROLE } from "../roles";
import { collections } from "./documents";
import { roleInGroup } from "./groups";

/** Pending requests one person may have at once, so made-up links can't fill the database. */
export const MAX_PENDING_REQUESTS = 20;
export const ANSWERED = "That request has already been answered.";

/** What the no-access page offers: an invite waiting for this person, or the state of their request. */
export interface AccessState {
  inviteToken?: string;
  request?: "pending" | "denied";
}

export interface RequestSummary {
  id: string;
  name: string;
  email: string;
  /** The requester's Google photo's address, or null (shown through googlePhotoUrl). */
  image: string | null;
  message?: string;
  createdAt: Date;
}

/** A request as its sender sees it: nothing about the group, which they aren't in (§8). */
export interface MyRequest {
  groupId: string;
  status: "pending" | "denied";
  message?: string;
  createdAt: Date;
}

const asObjectId = (id: string) => {
  try {
    return toObjectId(id);
  } catch (error) {
    if (error instanceof InvalidIdError) return null;
    throw error;
  }
};

/**
 * For the no-access page (F4). Looks the same for a made-up group as for a real one the person isn't
 * in, except to someone holding an invite to the real one.
 */
export async function accessState(db: Db, groupId: string, user: { id: string; email: string }, now = new Date()): Promise<AccessState> {
  const gid = asObjectId(groupId);
  if (!gid) return {};
  const { invites, accessRequests, groups } = collections(db);
  const [invite, request] = await Promise.all([
    invites.findOne({ groupId: gid, emailNormalized: normalizeEmail(user.email), status: "pending", expiresAt: { $gt: now } }),
    accessRequests.findOne({ groupId: gid, userId: toObjectId(user.id) }),
  ]);
  const inviteWorks = invite && (await groups.findOne({ _id: gid, deletedAt: { $exists: false } }));
  return {
    ...(inviteWorks && { inviteToken: invite.token }),
    ...((request?.status === "pending" || request?.status === "denied") && { request: request.status }),
  };
}

/**
 * F4: asks the group's Admins for access. Kept even for a group that doesn't exist, so the page and
 * the dashboard look the same either way (decided in step 8); a malformed id can't be a group and is
 * not saved. "declined" once an Admin has said no: they can still invite the person.
 */
export async function requestAccess(
  db: Db,
  groupId: string,
  user: { id: string; email: string },
  message: string | undefined,
  now = new Date(),
): Promise<"sent" | "declined"> {
  const gid = asObjectId(groupId);
  if (!gid) return "sent";
  const uid = toObjectId(user.id);
  const { accessRequests, memberships } = collections(db);
  if (await memberships.findOne({ groupId: gid, userId: uid })) return "sent"; // already in; nothing to ask
  const existing = await accessRequests.findOne({ groupId: gid, userId: uid });
  if (existing?.status === "pending") return "sent";
  if (existing?.status === "denied") return "declined";
  if ((await accessRequests.countDocuments({ userId: uid, status: "pending" })) >= MAX_PENDING_REQUESTS) {
    throw new MemberError(`You have ${MAX_PENDING_REQUESTS} requests waiting for an answer. Wait for some of them first.`);
  }
  // One record per person per group: someone approved and later removed asks again in the same one.
  await accessRequests.updateOne(
    { groupId: gid, userId: uid },
    {
      $set: { status: "pending", email: user.email, createdAt: now, ...(message && { message }) },
      $unset: { decidedBy: "", decidedAt: "", ...(!message && { message: "" }) },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  );
  return "sent";
}

/** Pending requests to a group, oldest first, for its members page. */
export async function listRequests(db: Db, groupId: string): Promise<RequestSummary[]> {
  const { accessRequests, users } = collections(db);
  const found = await accessRequests.find({ groupId: toObjectId(groupId), status: "pending" }).sort({ createdAt: 1 }).toArray();
  const people = await users.find({ _id: { $in: found.map((r) => r.userId) } }, { projection: { name: 1, image: 1 } }).toArray();
  const byId = new Map(people.map((u) => [u._id.toHexString(), u]));
  return found.map((r) => ({
    id: r._id.toHexString(),
    name: byId.get(r.userId.toHexString())?.name ?? r.email,
    email: r.email,
    image: byId.get(r.userId.toHexString())?.image ?? null,
    ...(r.message && { message: r.message }),
    createdAt: r.createdAt,
  }));
}

/** Pending requests per group, for the badges of the groups someone manages. */
export async function pendingRequestCounts(db: Db, groupIds: string[]): Promise<Map<string, number>> {
  const counts = await collections(db)
    .accessRequests.aggregate<{ _id: ObjectId; count: number }>([
      { $match: { groupId: { $in: groupIds.map(toObjectId) }, status: "pending" } },
      { $group: { _id: "$groupId", count: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(counts.map((c) => [c._id.toHexString(), c.count]));
}

/**
 * Admin and up answer a request: approve with a role (the membership, the request and any pending
 * invite for the same person, in one transaction), or deny.
 */
export async function decideRequest(
  database: Database,
  groupId: string,
  actorId: string,
  requestId: string,
  decision: GrantableRole | "deny",
  now = new Date(),
): Promise<void> {
  await roleInGroup(database.db, groupId, actorId, MIN_ROLE.handleAccessRequests);
  const gid = toObjectId(groupId);
  const rid = asObjectId(requestId);
  if (!rid) throw new MemberError(ANSWERED);
  const { accessRequests, memberships, invites } = collections(database.db);
  const decided = { decidedBy: actorId, decidedAt: now };

  if (decision === "deny") {
    const { modifiedCount } = await accessRequests.updateOne({ _id: rid, groupId: gid, status: "pending" }, { $set: { status: "denied", ...decided } });
    if (modifiedCount !== 1) throw new MemberError(ANSWERED);
    return;
  }
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const request = await accessRequests.findOne({ _id: rid, groupId: gid, status: "pending" }, { session });
      if (!request) throw new MemberError(ANSWERED);
      if (!(await memberships.findOne({ groupId: gid, userId: request.userId }, { session }))) {
        await memberships.insertOne({ _id: new ObjectId(), groupId: gid, userId: request.userId, role: decision, addedBy: actorId, createdAt: now }, { session });
      }
      await accessRequests.updateOne({ _id: rid }, { $set: { status: "approved", ...decided } }, { session });
      await invites.updateMany(
        { groupId: gid, emailNormalized: normalizeEmail(request.email), status: "pending" },
        { $set: { status: "accepted", ...decided } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}

/** The person's own pending and declined requests, newest first, for their dashboard. */
export async function myRequests(db: Db, userId: string): Promise<MyRequest[]> {
  const found = await collections(db)
    .accessRequests.find({ userId: toObjectId(userId), status: { $in: ["pending", "denied"] } })
    .sort({ createdAt: -1 })
    .toArray();
  return found.map((r) => ({
    groupId: r.groupId.toHexString(),
    status: r.status as MyRequest["status"],
    ...(r.message && { message: r.message }),
    createdAt: r.createdAt,
  }));
}
