import { randomBytes } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import type { Database } from "../db";
import { InvalidIdError, toObjectId } from "../ids";
import { maskEmail, MemberError, normalizeEmail, type GrantableRole } from "../members-rules";
import { MIN_ROLE } from "../roles";
import { collections } from "./documents";
import { roleInGroup } from "./groups";

/** How long an invite link works (F3). */
export const INVITE_DAYS = 14;
const DAY = 86_400_000;

/** One answer for an unknown, expired, revoked, declined or used link, and for a deleted group. */
export const INVALID_INVITE = "This invite link isn't valid any more.";

export interface InviteSummary {
  id: string;
  email: string;
  role: GrantableRole;
  token: string;
  invitedBy: string; // their name
  expiresAt: Date;
}

/** An invite waiting for the signed-in person, as their dashboard or the invite page shows it. */
export interface InviteForMe {
  token: string;
  groupId: string;
  groupName: string;
  role: GrantableRole;
  invitedBy: string;
  email: string; // the address it was sent to
}

/**
 * Whether `token` looks like one of ours (32 random bytes, base64url). Checked before any query: a
 * server action accepts whatever its caller sends, and an object such as { $regex: "^a" } would
 * otherwise match other people's invites (found in step 11's review).
 */
const isInviteToken = (token: unknown): token is string => typeof token === "string" && /^[\w-]{43}$/.test(token);

async function namesOf(db: Db, userIds: string[]) {
  const ids = userIds.flatMap((id) => (ObjectId.isValid(id) ? [new ObjectId(id)] : []));
  const users = await collections(db).users.find({ _id: { $in: ids } }, { projection: { name: 1 } }).toArray();
  const byId = new Map(users.map((u) => [u._id.toHexString(), u.name]));
  return (id: string) => byId.get(id) ?? "Someone";
}

/**
 * F3: invites an email address to the group (Admin and up). Inviting an address that already has a
 * pending invite refreshes it (role and expiry) and keeps its link. Refused for an existing member.
 */
export async function createInvite(
  db: Db,
  groupId: string,
  actorId: string,
  input: { email: string; role: GrantableRole },
  now = new Date(),
): Promise<{ token: string }> {
  await roleInGroup(db, groupId, actorId, MIN_ROLE.manageMembers);
  const gid = toObjectId(groupId);
  const email = input.email.trim();
  const emailNormalized = normalizeEmail(email);
  const { memberships, users, invites } = collections(db);

  const memberIds = (await memberships.find({ groupId: gid }, { projection: { userId: 1 } }).toArray()).map((m) => m.userId);
  const memberEmails = await users.find({ _id: { $in: memberIds } }, { projection: { email: 1 } }).toArray();
  if (memberEmails.some((u) => normalizeEmail(u.email) === emailNormalized)) throw new MemberError(`${email} is already a member of this group.`);

  const invite = await invites.findOneAndUpdate(
    { groupId: gid, emailNormalized, status: "pending" },
    {
      $set: { email, role: input.role, invitedBy: actorId, expiresAt: new Date(now.getTime() + INVITE_DAYS * DAY) },
      $setOnInsert: { _id: new ObjectId(), token: randomBytes(32).toString("base64url"), createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  return { token: invite!.token };
}

/** Pending invites that still work, newest first, for the members page. */
export async function listInvites(db: Db, groupId: string, now = new Date()): Promise<InviteSummary[]> {
  const found = await collections(db)
    .invites.find({ groupId: toObjectId(groupId), status: "pending", expiresAt: { $gt: now } })
    .sort({ createdAt: -1 })
    .toArray();
  const nameOf = await namesOf(db, found.map((i) => i.invitedBy));
  return found.map((i) => ({ id: i._id.toHexString(), email: i.email, role: i.role, token: i.token, invitedBy: nameOf(i.invitedBy), expiresAt: i.expiresAt }));
}

/** Admin and up cancel a pending invite; its link stops working. */
export async function revokeInvite(db: Db, groupId: string, actorId: string, inviteId: string, now = new Date()): Promise<void> {
  await roleInGroup(db, groupId, actorId, MIN_ROLE.manageMembers);
  let id;
  try {
    id = toObjectId(inviteId);
  } catch (error) {
    if (error instanceof InvalidIdError) return;
    throw error;
  }
  await collections(db).invites.updateOne(
    { _id: id, groupId: toObjectId(groupId), status: "pending" },
    { $set: { status: "revoked", decidedBy: actorId, decidedAt: now } },
  );
}

/** The invite behind a link, if it still works and its group still exists. */
export async function inviteForToken(db: Db, token: string, now = new Date()): Promise<InviteForMe | null> {
  if (!isInviteToken(token)) return null;
  const { invites, groups } = collections(db);
  const invite = await invites.findOne({ token, status: "pending", expiresAt: { $gt: now } });
  const group = invite && (await groups.findOne({ _id: invite.groupId, deletedAt: { $exists: false } }));
  if (!invite || !group) return null;
  const nameOf = await namesOf(db, [invite.invitedBy]);
  return { token, groupId: group._id.toHexString(), groupName: group.name, role: invite.role, invitedBy: nameOf(invite.invitedBy), email: invite.email };
}

/** Invites waiting for this person (matched by normalized email), for groups they aren't in yet. */
export async function invitesForUser(db: Db, user: { id: string; email: string }, now = new Date()): Promise<InviteForMe[]> {
  const { invites, groups, memberships } = collections(db);
  const found = await invites.find({ emailNormalized: normalizeEmail(user.email), status: "pending", expiresAt: { $gt: now } }).toArray();
  const groupIds = found.map((i) => i.groupId);
  const [liveGroups, mine] = await Promise.all([
    groups.find({ _id: { $in: groupIds }, deletedAt: { $exists: false } }).toArray(),
    memberships.find({ userId: toObjectId(user.id), groupId: { $in: groupIds } }).toArray(),
  ]);
  const nameOfGroup = new Map(liveGroups.map((g) => [g._id.toHexString(), g.name]));
  const joined = new Set(mine.map((m) => m.groupId.toHexString()));
  const nameOf = await namesOf(db, found.map((i) => i.invitedBy));
  return found.flatMap((i) => {
    const groupId = i.groupId.toHexString();
    const groupName = nameOfGroup.get(groupId);
    if (!groupName || joined.has(groupId)) return [];
    return [{ token: i.token, groupId, groupName, role: i.role, invitedBy: nameOf(i.invitedBy), email: i.email }];
  });
}

/**
 * F3: the invited person accepts. In one transaction: the membership (unless they joined meanwhile),
 * the invite marked accepted, and their pending access request to the group approved. The group's id.
 */
export async function acceptInvite(database: Database, token: string, user: { id: string; email: string }, now = new Date()): Promise<string> {
  if (!isInviteToken(token)) throw new MemberError(INVALID_INVITE);
  const { invites, groups, memberships, accessRequests } = collections(database.db);
  const uid = toObjectId(user.id);
  const session = database.client.startSession();
  try {
    return await session.withTransaction(async () => {
      const invite = await invites.findOne({ token, status: "pending", expiresAt: { $gt: now } }, { session });
      const group = invite && (await groups.findOne({ _id: invite.groupId, deletedAt: { $exists: false } }, { session }));
      if (!invite || !group) throw new MemberError(INVALID_INVITE);
      if (invite.emailNormalized !== normalizeEmail(user.email)) throw new MemberError(`This invite is for ${maskEmail(invite.email)}.`);

      if (!(await memberships.findOne({ groupId: invite.groupId, userId: uid }, { session }))) {
        await memberships.insertOne(
          { _id: new ObjectId(), groupId: invite.groupId, userId: uid, role: invite.role, addedBy: invite.invitedBy, createdAt: now },
          { session },
        );
      }
      await invites.updateOne({ _id: invite._id }, { $set: { status: "accepted", decidedBy: user.id, decidedAt: now } }, { session });
      await accessRequests.updateOne(
        { groupId: invite.groupId, userId: uid, status: "pending" },
        { $set: { status: "approved", decidedBy: user.id, decidedAt: now } },
        { session },
      );
      return invite.groupId.toHexString();
    });
  } finally {
    await session.endSession();
  }
}

/** The invited person says no. Only their own invite; anything else is ignored. */
export async function declineInvite(db: Db, token: string, user: { id: string; email: string }, now = new Date()): Promise<void> {
  if (!isInviteToken(token)) return;
  await collections(db).invites.updateOne(
    { token, status: "pending", emailNormalized: normalizeEmail(user.email) },
    { $set: { status: "declined", decidedBy: user.id, decidedAt: now } },
  );
}
