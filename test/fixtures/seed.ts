import type { Database } from "@/server/db";
import { toObjectId } from "@/server/ids";
import { applyOperations } from "@/server/operations/apply";
import { operationsFromFamily } from "@/server/operations/from-family";
import { collections } from "@/server/repositories/documents";
import { cruzYoung, inLawParentIds } from "./cruz-young";

/** The sample family's group in familytree_dev. Real groups arrive in step 5. */
export const SAMPLE_GROUP_ID = "000000000000000000000001";

/**
 * Replaces the sample group's content with the sample family, through applyOperations.
 * Clearing the group first is development tooling only; the app itself never deletes this way.
 */
export async function seedSampleFamily(database: Database, groupId = SAMPLE_GROUP_ID) {
  const gid = toObjectId(groupId);
  const { persons, unions, sheets } = collections(database.db);
  await Promise.all([persons.deleteMany({ groupId: gid }), unions.deleteMany({ groupId: gid }), sheets.deleteMany({ groupId: gid })]);
  const ops = operationsFromFamily(cruzYoung, [
    { title: "Cruz family", rootPersonId: "alexander-cruz", extraPersonIds: inLawParentIds, pinned: true },
    { title: "Jerry Willow's family", rootPersonId: "jerry-willow", pinned: true },
  ]);
  return applyOperations(database, groupId, ops, "seed");
}
