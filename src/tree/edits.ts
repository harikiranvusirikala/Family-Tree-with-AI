// Edits made by hand (F6), turned into operations (ARCHITECTURE.md §10). Pure, so they run in the
// browser and in tests. The server validates every batch again in applyOperations.
import type { Operation } from "@/server/operations/schema";
import type { FamilyData, Gender, NamedSheet, Person, Union } from "./types";

export interface NewPerson {
  name: string;
  gender: Gender;
  birthYear?: number;
  deathYear?: number;
}

const createPerson = (tempId: string, p: NewPerson): Operation => ({
  op: "createPerson",
  tempId,
  name: p.name,
  gender: p.gender,
  ...(p.birthYear !== undefined && { birthYear: p.birthYear }),
  ...(p.deathYear !== undefined && { deathYear: p.deathYear }),
});

/** A person's parents' couple, their own couples, and the people in them. */
export function relationsOf(family: FamilyData, personId: string) {
  const byId = new Map(family.persons.map((p) => [p.id, p]));
  const people = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  const parentsCouple = family.unions.find((u) => u.childIds.includes(personId));
  const couples = family.unions.filter((u) => u.partnerIds.includes(personId));
  return {
    parentsCouple,
    parents: people(parentsCouple?.partnerIds ?? []),
    couples: couples.map((union) => ({
      union,
      partner: people(union.partnerIds.filter((id) => id !== personId))[0] as Person | undefined, // none: on their own
      children: people(union.childIds),
    })),
  };
}

/**
 * Add parents. With no parents yet: one or two new people, their couple, and this person as their
 * child. With one parent: the other parent joins that parent's couple.
 */
export function addParentsOps(family: FamilyData, personId: string, parents: NewPerson[]): Operation[] {
  const { parentsCouple } = relationsOf(family, personId);
  if (parentsCouple && parentsCouple.partnerIds.length === 2) throw new Error("They already have two parents.");
  if (parentsCouple) {
    if (parents.length !== 1) throw new Error("Add one more parent.");
    return [createPerson("new:parent-1", parents[0]), { op: "addPartner", unionId: parentsCouple.id, personId: "new:parent-1" }];
  }
  if (parents.length < 1 || parents.length > 2) throw new Error("Add one or two parents.");
  const ids = parents.map((_, i) => `new:parent-${i + 1}`);
  return [
    ...parents.map((p, i) => createPerson(ids[i], p)),
    { op: "createUnion", tempId: "new:parents", partnerIds: ids as [string] | [string, string], status: "married" },
    { op: "addChild", unionId: "new:parents", childId: personId },
  ];
}

/** Add a partner, married or divorced. Someone who married in usually gets their own sheet too. */
export function addPartnerOps(
  personId: string,
  partner: NewPerson,
  { status, ownSheet }: { status: Union["status"]; ownSheet: boolean },
): Operation[] {
  return [
    createPerson("new:partner", partner),
    { op: "createUnion", tempId: "new:couple", partnerIds: [personId, "new:partner"], status },
    ...(ownSheet ? [{ op: "createSheet", tempId: "new:sheet", title: `${partner.name}'s family`, rootPersonId: "new:partner" } as const] : []),
  ];
}

/**
 * Add a child to one of the person's couples (`unionId`), or with no partner (`null`): their existing
 * single-parent couple, or a new one.
 */
export function addChildOps(family: FamilyData, personId: string, unionId: string | null, child: NewPerson): Operation[] {
  const add = (union: string): Operation => ({ op: "addChild", unionId: union, childId: "new:child" });
  if (unionId) return [createPerson("new:child", child), add(unionId)];
  const alone = family.unions.find((u) => u.partnerIds.length === 1 && u.partnerIds[0] === personId);
  if (alone) return [createPerson("new:child", child), add(alone.id)];
  return [
    createPerson("new:child", child),
    { op: "createUnion", tempId: "new:alone", partnerIds: [personId], status: "married" },
    add("new:alone"),
  ];
}

/** Only the fields that changed. A year left empty is cleared. */
export function editPersonOps(person: Person, next: NewPerson): Operation[] {
  const set: Extract<Operation, { op: "updatePerson" }>["set"] = {};
  if (next.name !== person.name) set.name = next.name;
  if (next.gender !== person.gender) set.gender = next.gender;
  for (const key of ["birthYear", "deathYear"] as const) {
    if (next[key] !== person[key]) set[key] = next[key] ?? null;
  }
  return Object.keys(set).length ? [{ op: "updatePerson", personId: person.id, set }] : [];
}

export const coupleStatusOps = (unionId: string, status: Union["status"]): Operation[] => [{ op: "updateUnion", unionId, status }];
export const deletePersonOps = (personId: string): Operation[] => [{ op: "deletePerson", personId }];
export const restorePersonOps = (personId: string): Operation[] => [{ op: "restorePerson", personId }];
/** A photo uploaded to Cloudinary (F8), or null to remove it. The replaced photo is deleted once saved. */
export const setPhotoOps = (personId: string, photoId: string | null): Operation[] => [{ op: "setPhoto", personId, photoId }];
export const newSheetOps = (rootPersonId: string, title: string): Operation[] => [
  { op: "createSheet", tempId: "new:sheet", title, rootPersonId },
];
export const showOnSheetOps = (sheetId: string, personId: string): Operation[] => [{ op: "addToSheet", sheetId, personId }];
export const updateSheetOps = (sheetId: string, set: { title?: string; pinned?: boolean }): Operation[] => [
  { op: "updateSheet", sheetId, set },
];

/** The tabs as shown: pinned first (Father's, then Mother's), then the rest in their saved order. */
export function tabOrder<T extends Pick<NamedSheet, "pinned" | "order">>(sheets: T[]): T[] {
  return [...sheets].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
}

/**
 * Move a tab one place left (-1) or right (+1) among the tabs like it (pinned or not), saving the
 * whole order. Null when it can't move that way.
 */
export function moveSheetOps(sheets: NamedSheet[], sheetId: string, direction: -1 | 1): Operation[] | null {
  const tabs = tabOrder(sheets);
  const from = tabs.findIndex((s) => s.id === sheetId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= tabs.length || tabs[to].pinned !== tabs[from].pinned) return null;
  [tabs[from], tabs[to]] = [tabs[to], tabs[from]];
  return [{ op: "reorderSheets", sheetIds: tabs.map((s) => s.id) }];
}
