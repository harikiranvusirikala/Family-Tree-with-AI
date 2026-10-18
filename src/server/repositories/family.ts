import type { Db } from "mongodb";
import type { GroupTree, Person, Union } from "@/tree/types";
import { toObjectId } from "../ids";
import { collections, type PersonDoc, type SheetDoc, type UnionDoc } from "./documents";

/**
 * Everything needed to draw a group's sheets (F5): its people, couples and sheets, without
 * soft-deleted people. Deleted people are also removed from couples and sheet extras.
 */
export async function loadGroupTree(db: Db, groupId: string): Promise<GroupTree> {
  const gid = toObjectId(groupId);
  const { persons, unions, sheets } = collections(db);
  const alive = { groupId: gid, deletedAt: { $exists: false } };
  const [personDocs, unionDocs, sheetDocs] = await Promise.all([
    persons.find(alive).toArray(),
    unions.find(alive).toArray(),
    sheets.find({ groupId: gid }).toArray(),
  ]);
  return toGroupTree({ persons: personDocs, unions: unionDocs, sheets: sheetDocs });
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
        ...(p.birthYear !== undefined && { birthYear: p.birthYear }),
        ...(p.deathYear !== undefined && { deathYear: p.deathYear }),
        ...(p.photoId !== undefined && { photoId: p.photoId }),
      }),
    ),
    unions: docs.unions.flatMap((u): Union[] => {
      if (u.deletedAt) return [];
      const partnerIds = keep(u.partnerIds);
      if (partnerIds.length === 0) return [];
      return [{ id: u._id.toHexString(), partnerIds: partnerIds as Union["partnerIds"], status: u.status, childIds: keep(u.childIds) }];
    }),
    sheets: [...docs.sheets]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s._id.toHexString(),
        title: s.title,
        pinned: s.pinned,
        order: s.order,
        rootPersonId: s.rootPersonId.toHexString(),
        extraPersonIds: keep(s.extraPersonIds),
      })),
  };
}
