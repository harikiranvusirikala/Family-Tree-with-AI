// Edits made by hand (F6), turned into operations (ARCHITECTURE.md §10). Pure, so they run in the
// browser and in tests. The server validates every batch again in applyOperations.
import type { Operation } from "@/server/operations/schema";
import type { FamilyData, Gender, NamedSheet, Person, PhotoCrop, Union } from "./types";
import { DATE_FIELDS, lifeDates, MARRIAGE_FIELDS, type LifeDates, type MarriageDate } from "./years";

/** A person to add or the details to save: the name, gender, and years with full dates where known. */
export interface NewPerson extends LifeDates {
  name: string;
  gender: Gender;
}

const createPerson = (tempId: string, p: NewPerson): Operation => ({
  op: "createPerson",
  tempId,
  name: p.name,
  gender: p.gender,
  ...lifeDates(p),
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
 * A parent to add. `ownSheet` also gives them a sheet rooted at them: the mother's side of the family,
 * without the couple's children, who are on the father's side. Their sheets then stop at her: her
 * parents and cousins are on hers (§6).
 */
export interface NewParent extends NewPerson {
  ownSheet?: boolean;
}

/**
 * Add parents. With no parents yet: one or two new people, their couple, and this person as their
 * child. With one parent: the other parent joins that parent's couple. Then a sheet for each parent
 * given `ownSheet`, "<Name>'s family", which leaves out this couple's children (this person, their
 * brothers and sisters, and their families).
 */
export function addParentsOps(family: FamilyData, personId: string, parents: NewParent[]): Operation[] {
  const { parentsCouple } = relationsOf(family, personId);
  if (parentsCouple && parentsCouple.partnerIds.length === 2) throw new Error("They already have two parents.");
  if (parentsCouple ? parents.length !== 1 : parents.length < 1 || parents.length > 2) {
    throw new Error(parentsCouple ? "Add one more parent." : "Add one or two parents.");
  }
  const ids = parents.map((_, i) => `new:parent-${i + 1}`);
  const couple = parentsCouple?.id ?? "new:parents";
  const sheets = parents.flatMap((p, i): Operation[] =>
    p.ownSheet ? [{ op: "createSheet", tempId: `new:sheet-${i + 1}`, title: `${p.name}'s family`, rootPersonId: ids[i], hideChildrenOf: couple }] : [],
  );
  if (parentsCouple) return [createPerson(ids[0], parents[0]), { op: "addPartner", unionId: parentsCouple.id, personId: ids[0] }, ...sheets];
  return [
    ...parents.map((p, i) => createPerson(ids[i], p)),
    { op: "createUnion", tempId: "new:parents", partnerIds: ids as [string] | [string, string], status: "married" },
    { op: "addChild", unionId: "new:parents", childId: personId },
    ...sheets,
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

/**
 * Only the fields that changed. A year left empty is cleared. A new name also renames the person's
 * sheets that still have the title they were given, "<Name>'s family" (an owner request after step 11).
 */
export function editPersonOps(person: Person, next: NewPerson, sheets: NamedSheet[] = []): Operation[] {
  const set: Extract<Operation, { op: "updatePerson" }>["set"] = {};
  if (next.name !== person.name) set.name = next.name;
  if (next.gender !== person.gender) set.gender = next.gender;
  for (const key of DATE_FIELDS) {
    if (next[key] !== person[key]) set[key] = next[key] ?? null;
  }
  if (!Object.keys(set).length) return [];
  return [{ op: "updatePerson", personId: person.id, set }, ...(set.name ? renameSheetsOps(sheets, person, set.name) : [])];
}

/** The person's sheets still titled "<old name>'s family", renamed for their new name. Custom titles stay. */
export function renameSheetsOps(sheets: NamedSheet[], person: Pick<Person, "id" | "name">, newName: string): Operation[] {
  return sheets
    .filter((s) => s.rootPersonId === person.id && s.title === `${person.name}'s family`)
    .map((s) => ({ op: "updateSheet", sheetId: s.id, set: { title: `${newName}'s family` } }));
}

/** Never a pinned sheet (the father's and mother's) or the last one; people on it stay. */
export const deleteSheetOps = (sheetId: string): Operation[] => [{ op: "deleteSheet", sheetId }];

export const coupleStatusOps = (unionId: string, status: Union["status"]): Operation[] => [{ op: "updateUnion", unionId, set: { status } }];

/** A couple's marriage date (an owner request after the final check): only the fields that changed; an empty year clears the date. */
export function marriageDateOps(union: Union, next: MarriageDate): Operation[] {
  const set: Extract<Operation, { op: "updateUnion" }>["set"] = {};
  for (const key of MARRIAGE_FIELDS) {
    if (next[key] !== union[key]) set[key] = next[key] ?? null;
  }
  return Object.keys(set).length ? [{ op: "updateUnion", unionId: union.id, set }] : [];
}
export const deletePersonOps = (personId: string): Operation[] => [{ op: "deletePerson", personId }];
export const restorePersonOps = (personId: string): Operation[] => [{ op: "restorePerson", personId }];
/**
 * A photo uploaded to Cloudinary (F8), or null to remove it, with the rectangle around the person in it
 * (an owner request; none: the whole photo). A replaced photo is deleted once nobody uses it.
 */
export const setPhotoOps = (personId: string, photoId: string | null, crop?: PhotoCrop | null): Operation[] => [
  { op: "setPhoto", personId, photoId, ...(photoId && crop && { crop }) },
];
/**
 * A sheet rooted at someone. `hideChildrenOf`: one of their couples whose children it leaves out, as a
 * mother's own sheet does (Create their own sheet, an owner request after the final check).
 */
export const newSheetOps = (rootPersonId: string, title: string, hideChildrenOf?: string): Operation[] => [
  { op: "createSheet", tempId: "new:sheet", title, rootPersonId, ...(hideChildrenOf && { hideChildrenOf }) },
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
