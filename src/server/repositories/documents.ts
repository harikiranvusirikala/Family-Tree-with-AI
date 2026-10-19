// MongoDB document shapes (ARCHITECTURE.md §5). Every content record carries groupId.
// References are ObjectIds; audit fields (createdBy, addedBy, …) hold the acting user's id as a string.
import type { Db, ObjectId } from "mongodb";
import type { Gender, Union } from "@/tree/types";
import type { GrantableRole } from "../members-rules";
import type { Role } from "../roles";

export interface Audit {
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
}

export interface GroupDoc extends Audit {
  _id: ObjectId;
  name: string;
  deletedAt?: Date;
}

/** One per user per group. The role is read from here on every request, never from the session. */
export interface MembershipDoc {
  _id: ObjectId;
  groupId: ObjectId;
  userId: ObjectId; // Better Auth's users._id
  role: Role;
  addedBy: string;
  createdAt: Date;
}

/** F3: an invite by email, shared as the link /invite/{token}. Accepted only by that email. */
export interface InviteDoc {
  _id: ObjectId;
  groupId: ObjectId;
  email: string; // as typed
  emailNormalized: string; // normalizeEmail(email): what a signed-in user's email is matched against
  role: GrantableRole;
  token: string;
  invitedBy: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  expiresAt: Date;
  createdAt: Date;
  decidedBy?: string; // who accepted, declined or revoked it
  decidedAt?: Date;
}

/**
 * F4: one per person per group; asking again (after being removed) reopens it. `groupId` may not be a
 * real group: requests for made-up groups are kept like real ones, so they look the same (§8).
 */
export interface AccessRequestDoc {
  _id: ObjectId;
  groupId: ObjectId;
  userId: ObjectId;
  email: string;
  message?: string;
  status: "pending" | "approved" | "denied";
  createdAt: Date;
  decidedBy?: string;
  decidedAt?: Date;
}

/** F7: chat messages one person sent on one day (UTC), for the daily cap. Removed 30 days later. */
export interface ChatUsageDoc {
  _id: ObjectId;
  userId: ObjectId;
  day: string; // YYYY-MM-DD
  count: number;
  expiresAt: Date;
}

/** Better Auth's users, read here only to show names and emails. Better Auth writes them. */
export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
}

export interface PersonDoc extends Audit {
  _id: ObjectId;
  groupId: ObjectId;
  name: string;
  gender: Gender;
  birthYear?: number;
  deathYear?: number;
  photoId?: string;
  notes?: string;
  deletedAt?: Date;
}

export interface UnionDoc extends Audit {
  _id: ObjectId;
  groupId: ObjectId;
  partnerIds: ObjectId[]; // 1 or 2
  status: Union["status"];
  childIds: ObjectId[];
  deletedAt?: Date;
}

export interface SheetDoc extends Audit {
  _id: ObjectId;
  groupId: ObjectId;
  title: string;
  rootPersonId: ObjectId;
  pinned: boolean;
  order: number;
  extraPersonIds: ObjectId[];
}

export function collections(db: Db) {
  return {
    groups: db.collection<GroupDoc>("groups"),
    memberships: db.collection<MembershipDoc>("memberships"),
    invites: db.collection<InviteDoc>("invites"),
    accessRequests: db.collection<AccessRequestDoc>("accessRequests"),
    users: db.collection<UserDoc>("users"),
    chatUsage: db.collection<ChatUsageDoc>("chatUsage"),
    persons: db.collection<PersonDoc>("persons"),
    unions: db.collection<UnionDoc>("unions"),
    sheets: db.collection<SheetDoc>("sheets"),
  };
}

/** Creates the collections' indexes (§5). Safe to run repeatedly: `npm run db:setup`. */
export async function ensureIndexes(db: Db): Promise<void> {
  const { memberships, invites, accessRequests, chatUsage, persons, unions, sheets } = collections(db);
  await Promise.all([
    memberships.createIndex({ groupId: 1, userId: 1 }, { unique: true }),
    memberships.createIndex({ userId: 1 }),
    invites.createIndex({ token: 1 }, { unique: true }),
    // One pending invite per address per group (inviting again refreshes it).
    invites.createIndex({ groupId: 1, emailNormalized: 1 }, { unique: true, partialFilterExpression: { status: "pending" } }),
    invites.createIndex({ emailNormalized: 1, status: 1 }),
    invites.createIndex({ groupId: 1, status: 1 }),
    accessRequests.createIndex({ groupId: 1, userId: 1 }, { unique: true }),
    accessRequests.createIndex({ groupId: 1, status: 1 }),
    accessRequests.createIndex({ userId: 1, status: 1 }),
    chatUsage.createIndex({ userId: 1, day: 1 }, { unique: true }),
    chatUsage.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    persons.createIndex({ groupId: 1 }),
    unions.createIndex({ groupId: 1 }),
    unions.createIndex({ groupId: 1, partnerIds: 1 }),
    unions.createIndex({ groupId: 1, childIds: 1 }),
    sheets.createIndex({ groupId: 1 }),
    // Better Auth's collections: MongoDB removes expired sessions and sign-in states, so they don't
    // fill the 512 MB cluster. Better Auth creates its other indexes itself on first write; don't
    // repeat those here (the same keys under another index name fail).
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("verifications").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
