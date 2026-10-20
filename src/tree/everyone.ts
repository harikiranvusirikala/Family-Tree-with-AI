// ★ Everyone (an owner request after the final check): a built-in first tab that shows every person in
// the group. Not a stored sheet: computed here from the loaded group, like any sheet's view.
import { tabOrder } from "./edits";
import type { GroupTree, Person, SheetView } from "./types";

/** ★ Everyone's place in the address, /g/{groupId}/s/everyone. A sheet's id is 24 hex characters. */
export const EVERYONE = "everyone";

/**
 * Every person and every couple, drawn like a sheet: couples whose partners are all here, with the
 * children who are here (removed people are already left out of the loaded group). The root, which a
 * phone's first view centres on, is the first sheet's.
 */
export function everyoneView(tree: GroupTree): SheetView {
  const here = new Set(tree.persons.map((p) => p.id));
  const first = tabOrder(tree.sheets)[0];
  return {
    rootPersonId: first && here.has(first.rootPersonId) ? first.rootPersonId : (tree.persons[0]?.id ?? ""),
    persons: tree.persons,
    unions: tree.unions
      .filter((u) => u.partnerIds.every((p) => here.has(p)))
      .map((u) => ({ ...u, childIds: u.childIds.filter((c) => here.has(c)) })),
  };
}

/** Lower case, without accents or extra spaces: "Zoë  Ávila" matches "zoe avila" (as the import's duplicate check does). */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Find someone: the people whose name contains what was typed, names that start with it first, then
 * A to Z (and oldest first for the same name). At most `limit`.
 */
export function findPeople(persons: Person[], query: string, limit = 8): Person[] {
  const q = fold(query);
  if (!q) return [];
  const starts = (p: Person) => fold(p.name).startsWith(q) || fold(p.name).split(" ").some((word) => word.startsWith(q));
  return persons
    .filter((p) => fold(p.name).includes(q))
    .sort((a, b) => Number(starts(b)) - Number(starts(a)) || a.name.localeCompare(b.name) || (a.birthYear ?? 0) - (b.birthYear ?? 0))
    .slice(0, limit);
}
