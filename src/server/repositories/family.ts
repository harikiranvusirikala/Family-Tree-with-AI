import type { Db } from "mongodb";
import type { GroupTree, Person, Union } from "@/tree/types";
import type { GroupState } from "../operations/plan";
import { lifeDates, marriageDate } from "@/tree/years";
import { toObjectId } from "../ids";
import { collections, type PersonDoc, type SheetDoc, type UnionDoc } from "./documents";

/**
 * Everything needed to draw a group's sheets (F5): its people, couples and sheets, without
 * soft-deleted people or sheets. Deleted people are also removed from couples and sheet extras.
 */
export async function loadGroupTree(db: Db, groupId: string): Promise<GroupTree> {
  const gid = toObjectId(groupId);
  const { persons, unions, sheets } = collections(db);
  const alive = { groupId: gid, deletedAt: { $exists: false } };
  const [personDocs, unionDocs, sheetDocs] = await Promise.all([
    persons.find(alive).toArray(),
    unions.find(alive).toArray(),
    sheets.find(alive).toArray(),
  ]);
  return toGroupTree({ persons: personDocs, unions: unionDocs, sheets: sheetDocs });
}

/**
 * Every record of the group, soft-deleted people included: what the planner checks a batch against
 * (the AI chat dry-runs its proposals with it). `toGroupTree` turns it into what the browser draws.
 */
export async function loadGroupState(db: Db, groupId: string): Promise<GroupState> {
  const gid = toObjectId(groupId);
  const { persons, unions, sheets } = collections(db);
  const [personDocs, unionDocs, sheetDocs] = await Promise.all([
    persons.find({ groupId: gid }).toArray(),
    unions.find({ groupId: gid }).toArray(),
    sheets.find({ groupId: gid }).toArray(),
  ]);
  return { persons: personDocs, unions: unionDocs, sheets: sheetDocs };
}

/** Documents → the tree types used in the browser (pure; also used by tests). Skips deleted records. */
export function toGroupTree(docs: { persons: PersonDoc[]; unions: UnionDoc[]; sheets: SheetDoc[] }): GroupTree {
  const personDocs = docs.persons.filter((p) => !p.deletedAt);
  const ids = new Set(personDocs.map((p) => p._id.toHexString()));
  const keep = (list: { toHexString(): string }[]) => list.map((x) => x.toHexString()).filter((x) => ids.has(x));

  return {
    persons: personDocs.map(
      (p): Person => ({
        id: p._id.toHexString(),
        name: p.name,
        gender: p.gender,
        ...lifeDates(p),
        ...(p.photoId !== undefined && { photoId: p.photoId }),
      }),
    ),
    unions: docs.unions.flatMap((u): Union[] => {
      if (u.deletedAt) return [];
      const partnerIds = keep(u.partnerIds);
      if (partnerIds.length === 0) return [];
      // A marriage date belongs to a couple of two: with a partner deleted, it waits for Undo.
      const married = partnerIds.length === 2 ? marriageDate(u) : {};
      return [{ id: u._id.toHexString(), partnerIds: partnerIds as Union["partnerIds"], status: u.status, ...married, childIds: keep(u.childIds) }];
    }),
    sheets: docs.sheets
      .filter((s) => !s.deletedAt)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s._id.toHexString(),
        title: s.title,
        pinned: s.pinned,
        order: s.order,
        rootPersonId: s.rootPersonId.toHexString(),
        extraPersonIds: keep(s.extraPersonIds),
        ...(s.hideChildrenOf && { hideChildrenOf: s.hideChildrenOf.toHexString() }),
      })),
  };
}
