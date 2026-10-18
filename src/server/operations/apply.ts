import type { AnyBulkWriteOperation, ClientSession, Collection, Document } from "mongodb";
import type { Database } from "../db";
import { InvalidIdError, toObjectId } from "../ids";
import { collections } from "../repositories/documents";
import { OperationError, planOperations, type GroupState } from "./plan";
import { operationsSchema } from "./schema";

export { OperationError } from "./plan";

export interface ApplyResult {
  /** Temporary id ("new:1") → the real id it became. */
  idMap: Record<string, string>;
}

/**
 * The single write path (ARCHITECTURE.md §10): validates a batch of operations and applies all of
 * them in one transaction, or none. Callers check permissions first (requireRole, from step 5).
 */
export async function applyOperations(
  database: Database,
  groupId: string,
  input: unknown,
  actor: string,
): Promise<ApplyResult> {
  const parsed = operationsSchema.safeParse(input);
  if (!parsed.success) {
    const { path, message } = parsed.error.issues[0];
    const [index, ...field] = path;
    throw new OperationError(field.length ? `${field.join(".")}: ${message}` : message, typeof index === "number" ? index : -1);
  }
  let gid;
  try {
    gid = toObjectId(groupId);
  } catch (error) {
    if (error instanceof InvalidIdError) throw new OperationError("group not found", -1);
    throw error;
  }

  const { persons, unions, sheets } = collections(database.db);
  const session = database.client.startSession();
  try {
    // withTransaction retries the whole callback on transient conflicts, so state is re-read each time.
    return await session.withTransaction(async () => {
      const state: GroupState = {
        persons: await persons.find({ groupId: gid }, { session }).toArray(),
        unions: await unions.find({ groupId: gid }, { session }).toArray(),
        sheets: await sheets.find({ groupId: gid }, { session }).toArray(),
      };
      const plan = planOperations(gid, state, parsed.data, actor, new Date());
      await write(persons, plan.persons, session);
      await write(unions, plan.unions, session);
      await write(sheets, plan.sheets, session);
      return { idMap: plan.idMap };
    });
  } finally {
    await session.endSession();
  }
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
