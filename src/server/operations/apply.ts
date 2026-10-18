import type { AnyBulkWriteOperation, ClientSession, Collection, Db, Document, ObjectId } from "mongodb";
import type { Database } from "../db";
import { InvalidIdError, toObjectId } from "../ids";
import { collections } from "../repositories/documents";
import { OperationError, planOperations, type GroupState } from "./plan";
import { operationsSchema, type Operation } from "./schema";

export { OperationError } from "./plan";

export interface ApplyResult {
  /** Temporary id ("new:1") → the real id it became. */
  idMap: Record<string, string>;
}

/**
 * The single write path (ARCHITECTURE.md §10): validates a batch of operations and applies all of
 * them in one transaction, or none. Callers check permissions first (requireRole).
 */
export async function applyOperations(
  database: Database,
  groupId: string,
  input: unknown,
  actor: string,
): Promise<ApplyResult> {
  const ops = parseOperations(input);
  let gid;
  try {
    gid = toObjectId(groupId);
  } catch (error) {
    if (error instanceof InvalidIdError) throw new OperationError("group not found", -1);
    throw error;
  }

  const session = database.client.startSession();
  try {
    // withTransaction retries the whole callback on transient conflicts, so state is re-read each time.
    return await session.withTransaction(() => applyInTransaction(database.db, gid, ops, actor, session));
  } finally {
    await session.endSession();
  }
}

/** Validates an operations batch (zod). Throws OperationError naming the failing change. */
export function parseOperations(input: unknown): Operation[] {
  const parsed = operationsSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const { path, message } = parsed.error.issues[0];
  const [index, ...field] = path;
  throw new OperationError(field.length ? `${field.join(".")}: ${message}` : message, typeof index === "number" ? index : -1);
}

/**
 * Plans and writes a parsed batch inside the caller's transaction. For callers that write more in the
 * same transaction: creating a group (F2) adds the group and its owner membership.
 */
export async function applyInTransaction(
  db: Db,
  groupId: ObjectId,
  ops: Operation[],
  actor: string,
  session: ClientSession,
): Promise<ApplyResult> {
  const { persons, unions, sheets } = collections(db);
  const state: GroupState = {
    persons: await persons.find({ groupId }, { session }).toArray(),
    unions: await unions.find({ groupId }, { session }).toArray(),
    sheets: await sheets.find({ groupId }, { session }).toArray(),
  };
  const plan = planOperations(groupId, state, ops, actor, new Date());
  await write(persons, plan.persons, session);
  await write(unions, plan.unions, session);
  await write(sheets, plan.sheets, session);
  return { idMap: plan.idMap };
}

async function write<T extends Document & { _id: unknown; groupId: unknown }>(
  collection: Collection<T>,
  changes: { inserted: T[]; updated: T[] },
  session: ClientSession,
) {
  const ops = [
    ...changes.inserted.map((document) => ({ insertOne: { document } })),
    ...changes.updated.map((doc) => ({ replaceOne: { filter: { _id: doc._id, groupId: doc.groupId }, replacement: doc } })),
  ] as AnyBulkWriteOperation<T>[];
  if (ops.length) await collection.bulkWrite(ops, { session, ordered: true });
}
