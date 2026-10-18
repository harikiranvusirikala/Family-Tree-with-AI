// Pure helpers for planner-level tests: apply operations to an in-memory group, without a database.
import { ObjectId } from "mongodb";
import { operationsFromFamily } from "@/server/operations/from-family";
import { planOperations, type GroupState } from "@/server/operations/plan";
import type { Operation } from "@/server/operations/schema";
import { toGroupTree } from "@/server/repositories/family";
import type { GroupTree } from "@/tree/types";
import { cruzYoung, inLawParentIds } from "./fixtures/cruz-young";

export const emptyGroup: GroupState = { persons: [], unions: [], sheets: [] };

/** The group's state after planning `ops` and writing the plan. Throws OperationError like applyOperations. */
export function applyPlan(state: GroupState, ops: Operation[], groupId = new ObjectId()): GroupState {
  const plan = planOperations(groupId, state, ops, "tester", new Date());
  const merge = <T extends { _id: ObjectId }>(docs: T[], changes: { inserted: T[]; updated: T[] }) => {
    const byId = new Map(changes.updated.map((d) => [d._id.toHexString(), d]));
    return [...docs.map((d) => byId.get(d._id.toHexString()) ?? d), ...changes.inserted];
  };
  return {
    persons: merge(state.persons, plan.persons),
    unions: merge(state.unions, plan.unions),
    sheets: merge(state.sheets, plan.sheets),
  };
}

/** The sample family with its two sheets, as in the seed and the e2e groups. */
export function sampleState(): GroupState {
  return applyPlan(
    emptyGroup,
    operationsFromFamily(cruzYoung, [
      { title: "Cruz family", rootPersonId: "alexander-cruz", extraPersonIds: inLawParentIds, pinned: true },
      { title: "Jerry Willow's family", rootPersonId: "jerry-willow", pinned: true },
    ]),
  );
}

export { toGroupTree };
export type { GroupTree };
