// From a parsed file and the importer's choices to operations (F10). Pure: the browser builds the
// preview and the batch; the server re-checks the batch on the single write path.
import { lifeDates, marriageDate } from "@/tree/years";
import type { Operation } from "../operations/schema";
import type { Gender, GroupTree, Person } from "@/tree/types";
import type { ImportData, ImportPerson } from "./types";

const fold = (name: string) => name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface DuplicateMatch {
  imported: ImportPerson;
  /** Everyone in the group with the same name and birth year. */
  existing: Person[];
}

/** Imported people with the same name (case, accents and spaces aside) and birth year as someone in the group. */
export function findDuplicates(data: ImportData, tree: GroupTree): DuplicateMatch[] {
  const byKey = new Map<string, Person[]>();
  for (const p of tree.persons) {
    if (p.birthYear === undefined) continue;
    const key = `${fold(p.name)}|${p.birthYear}`;
    byKey.set(key, [...(byKey.get(key) ?? []), p]);
  }
  return data.persons.flatMap((imported) => {
    if (imported.birthYear === undefined) return [];
    const existing = byKey.get(`${fold(imported.name)}|${imported.birthYear}`);
    return existing ? [{ imported, existing }] : [];
  });
}

/**
 * The preview's starting choice for each possible duplicate: "Use existing", with the first match
 * (the owner's choice after step 10's check). "Keep both" is one click away.
 */
export function defaultUseExisting(duplicates: DuplicateMatch[]): Record<string, string> {
  return Object.fromEntries(duplicates.map((d) => [d.imported.id, d.existing[0].id]));
}

export interface ImportChoices {
  /** For people the file gives no sex: male or female, by imported id. */
  genders: Record<string, Gender>;
  /** "Use existing": imported id → the group's person to use instead. */
  useExisting: Record<string, string>;
  /** The person a GEDCOM import's sheet shows; the file's first person by default. */
  rootPersonId?: string;
  /** The group imported into; photos are kept only in the group the file came from. */
  targetGroupId?: string;
  /** Imported into an existing group: the file's sheets come in unpinned, after the group's own. */
  intoExistingGroup: boolean;
}

export interface ImportBatch {
  operations: Operation[];
  /** The temporary id of the sheet to open afterwards. */
  firstSheet: string;
}

/** The operations that import `data` with these choices, or what still has to be chosen. */
export function importOperations(data: ImportData, choices: ImportChoices, tree: GroupTree): ImportBatch | string {
  const index = new Map(data.persons.map((p, i) => [p.id, i]));
  const ref = (id: string) => choices.useExisting[id] ?? `new:p${index.get(id)}`;
  const nameOf = (id: string) => (choices.useExisting[id] ? tree.persons.find((p) => p.id === choices.useExisting[id])?.name : undefined) ?? data.persons[index.get(id)!].name;
  const keepPhotos = !!data.sourceGroupId && data.sourceGroupId === choices.targetGroupId;
  const ops: Operation[] = [];

  for (const p of data.persons) {
    if (choices.useExisting[p.id]) continue;
    const gender = p.gender ?? choices.genders[p.id];
    if (!gender) return `Choose male or female for ${p.name}.`;
    const tempId = ref(p.id);
    ops.push({ op: "createPerson", tempId, name: p.name, gender, ...lifeDates(p) });
    if (keepPhotos && p.photoId) ops.push({ op: "setPhoto", personId: tempId, photoId: p.photoId });
  }

  // A couple whose partners are all existing people may already be a couple in the group: use it.
  const key = (ids: string[]) => [...ids].sort().join("+");
  const coupleIn = new Map(tree.unions.map((u) => [key(u.partnerIds), u.id]));
  const coupleRef = new Map<string, string>(); // the file's couple id → its reference in the operations
  data.unions.forEach((u, i) => {
    const partners = u.partnerIds.map(ref) as [string] | [string, string];
    let couple = partners.every((p) => !p.startsWith("new:")) ? coupleIn.get(key(partners)) : undefined;
    if (!couple) {
      couple = `new:u${i}`;
      ops.push({ op: "createUnion", tempId: couple, partnerIds: partners, status: u.status, ...marriageDate(u) });
    }
    coupleRef.set(u.id, couple);
    for (const c of u.childIds) ops.push({ op: "addChild", unionId: couple, childId: ref(c) });
  });

  // The file's sheets, or one sheet for the chosen person, so the import has somewhere to open.
  const sheets = data.sheets.length
    ? data.sheets
    : [{ title: "", rootPersonId: choices.rootPersonId ?? data.persons[0]?.id, extraPersonIds: [], pinned: !choices.intoExistingGroup }];
  if (!sheets[0]?.rootPersonId) return "This file has no people to import.";
  sheets.forEach((s, i) => {
    const tempId = `new:s${i}`;
    const hidden = s.hideChildrenOf === undefined ? undefined : coupleRef.get(s.hideChildrenOf);
    ops.push({
      op: "createSheet",
      tempId,
      title: s.title || `${nameOf(s.rootPersonId)}'s family`,
      rootPersonId: ref(s.rootPersonId),
      pinned: choices.intoExistingGroup ? false : s.pinned,
      ...(hidden && { hideChildrenOf: hidden }),
    });
    for (const extra of s.extraPersonIds) ops.push({ op: "addToSheet", sheetId: tempId, personId: ref(extra) });
  });
  return { operations: ops, firstSheet: "new:s0" };
}
