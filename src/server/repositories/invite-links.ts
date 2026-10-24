import { randomBytes } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import type { Database } from "../db";
import { InvalidIdError, toObjectId } from "../ids";
import { inviteLinkProblem, joiningRole, MemberError, normalizeEmail, type LinkRole } from "../members-rules";
import { MIN_ROLE } from "../roles";
import { collections } from "./documents";
import { roleInGroup } from "./groups";
import { INVALID_INVITE, isInviteToken, namesOf } from "./invites";

const DAY = 86_400_000;

export interface InviteLinkSummary {
  id: string;
  role: LinkRole;
  token: string;
  createdBy: string; // their name
  expiresAt: Date;
  uses: number;
  maxUses?: number;
  /** The members who joined by it and are still in the group, by name. */
  joined: string[];
}

/** An invite link as its page shows it, before someone joins. */
export interface InviteLinkForMe {
  groupId: string;
  groupName: string;
  role: LinkRole;
  invitedBy: string;
}

/** A link that still lets people in: active, unexpired and not used up. */
const working = (now: Date) => ({
  status: "active" as const,
  expiresAt: { $gt: now },
  $or: [{ maxUses: { $exists: false } }, { $expr: { $lt: ["$uses", "$maxUses"] } }],
});

/** Admin and up make an invite link for View or Maintain, for 1, 7 or 30 days, optionally for at most `maxUses` people. */
export async function createInviteLink(
  db: Db,
  groupId: string,
  actorId: string,
  input: { role: LinkRole; days: number; maxUses?: number },
  now = new Date(),
): Promise<{ token: string }> {
  await roleInGroup(db, groupId, actorId, MIN_ROLE.manageMembers);
  const problem = inviteLinkProblem(input);
  if (problem) throw new MemberError(problem);
  const token = randomBytes(32).toString("base64url");
  await collections(db).inviteLinks.insertOne({
    _id: new ObjectId(),
    groupId: toObjectId(groupId),
    role: input.role,
    token,
    createdBy: actorId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + input.days * DAY),
    ...(input.maxUses !== undefined && { maxUses: input.maxUses }),
    uses: 0,
    status: "active",
  });
  return { token };
}

/** Active, unexpired links (used-up ones too, so Admins see why they stopped), newest first, for the members page. */
export async function listInviteLinks(db: Db, groupId: string, now = new Date()): Promise<InviteLinkSummary[]> {
  const gid = toObjectId(groupId);
  const { inviteLinks, memberships } = collections(db);
  const links = await inviteLinks.find({ groupId: gid, status: "active", expiresAt: { $gt: now } }).sort({ createdAt: -1 }).toArray();
  const joined = await memberships.find({ groupId: gid, inviteLinkId: { $in: links.map((l) => l._id) } }, { projection: { userId: 1, inviteLinkId: 1 } }).toArray();
  const nameOf = await namesOf(db, [...links.map((l) => l.createdBy), ...joined.map((m) => m.userId.toHexString())]);
  return links.map((l) => ({
    id: l._id.toHexString(),
    role: l.role,
    token: l.token,
    createdBy: nameOf(l.createdBy),
    expiresAt: l.expiresAt,
    uses: l.uses,
    ...(l.maxUses !== undefined && { maxUses: l.maxUses }),
    joined: joined
      .filter((m) => m.inviteLinkId?.equals(l._id))
      .map((m) => nameOf(m.userId.toHexString()))
      .sort((a, b) => a.localeCompare(b)),
  }));
}

/** Admin and up stop a link; nobody else can join by it. Those who joined stay members. */
export async function revokeInviteLink(db: Db, groupId: string, actorId: string, linkId: string, now = new Date()): Promise<void> {
  await roleInGroup(db, groupId, actorId, MIN_ROLE.manageMembers);
  let id;
  try {
    id = toObjectId(linkId);
  } catch (error) {
    if (error instanceof InvalidIdError) return;
    throw error;
  }
  await collections(db).inviteLinks.updateOne(
    { _id: id, groupId: toObjectId(groupId), status: "active" },
    { $set: { status: "revoked", revokedBy: actorId, revokedAt: now } },
  );
}

/** The link behind /join/{token}, if it still lets people in and its group still exists. */
export async function inviteLinkForToken(db: Db, token: string, now = new Date()): Promise<InviteLinkForMe | null> {
  if (!isInviteToken(token)) return null;
  const { inviteLinks, groups } = collections(db);
  const link = await inviteLinks.findOne({ token, ...working(now) });
  const group = link && (await groups.findOne({ _id: link.groupId, deletedAt: { $exists: false } }));
  if (!link || !group) return null;
  const nameOf = await namesOf(db, [link.createdBy]);
  return { groupId: group._id.toHexString(), groupName: group.name, role: link.role, invitedBy: nameOf(link.createdBy) };
}

/**
 * Joins the signed-in person by an invite link. In one transaction: the membership, with the higher
 * of the link's role and a pending email invite's; one more use, only while under the limit (so two
 * people at the same moment can't pass it); their pending email invites accepted; and their access
 * request approved, even a denied one (the Admin chose to share the link). A member already keeps
 * their role and isn't counted. The group's id.
 */
export async function joinByLink(database: Database, token: string, user: { id: string; email: string }, now = new Date()): Promise<string> {
  if (!isInviteToken(token)) throw new MemberError(INVALID_INVITE);
  const { inviteLinks, groups, memberships, invites, accessRequests } = collections(database.db);
  const uid = toObjectId(user.id);
  const session = database.client.startSession();
  try {
    return await session.withTransaction(async () => {
      const link = await inviteLinks.findOne({ token, ...working(now) }, { session });
      const group = link && (await groups.findOne({ _id: link.groupId, deletedAt: { $exists: false } }, { session }));
      if (!link || !group) throw new MemberError(INVALID_INVITE);
      if (await memberships.findOne({ groupId: link.groupId, userId: uid }, { session })) return link.groupId.toHexString();

      const { modifiedCount } = await inviteLinks.updateOne({ _id: link._id, ...working(now) }, { $inc: { uses: 1 } }, { session });
      if (modifiedCount !== 1) throw new MemberError(INVALID_INVITE);
      const emailNormalized = normalizeEmail(user.email);
      const waiting = await invites.find({ groupId: link.groupId, emailNormalized, status: "pending", expiresAt: { $gt: now } }, { session }).toArray();
      await memberships.insertOne(
        {
          _id: new ObjectId(),
          groupId: link.groupId,
          userId: uid,
          role: joiningRole(link.role, waiting.map((i) => i.role)),
          addedBy: link.createdBy,
          createdAt: now,
          inviteLinkId: link._id,
        },
        { session },
      );
      const decided = { decidedBy: user.id, decidedAt: now };
      await invites.updateMany({ groupId: link.groupId, emailNormalized, status: "pending" }, { $set: { status: "accepted", ...decided } }, { session });
      await accessRequests.updateOne(
        { groupId: link.groupId, userId: uid, status: { $in: ["pending", "denied"] } },
        { $set: { status: "approved", ...decided } },
        { session },
      );
      return link.groupId.toHexString();
    });
  } finally {
    await session.endSession();
  }
}
