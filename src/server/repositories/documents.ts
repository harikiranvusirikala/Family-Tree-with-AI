// MongoDB document shapes (ARCHITECTURE.md §5). Every content record carries groupId.
// References are ObjectIds; audit fields (createdBy, addedBy, …) hold the acting user's id as a string.
import type { Db, ObjectId } from "mongodb";
import type { Gender, Union } from "@/tree/types";
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
    persons: db.collection<PersonDoc>("persons"),
    unions: db.collection<UnionDoc>("unions"),
    sheets: db.collection<SheetDoc>("sheets"),
  };
}

/** Creates the collections' indexes (§5). Safe to run repeatedly: `npm run db:setup`. */
export async function ensureIndexes(db: Db): Promise<void> {
  const { memberships, persons, unions, sheets } = collections(db);
  await Promise.all([
    memberships.createIndex({ groupId: 1, userId: 1 }, { unique: true }),
    memberships.createIndex({ userId: 1 }),
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
