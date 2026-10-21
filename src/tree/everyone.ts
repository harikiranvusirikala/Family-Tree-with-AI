// ★ Everyone (an owner request after the final check): a built-in first tab that shows every person in
// the group. Not a stored sheet: computed here from the loaded group, like any sheet's view.
import { tabOrder } from "./edits";
import { buildSheetView } from "./sheet-view";
import type { GroupTree, NamedSheet, Person, SheetView } from "./types";
import { birthOrder } from "./years";

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

/** Whether a name contains what was typed (case, accents and extra spaces ignored). Everyone, for nothing typed. */
export const nameMatches = (name: string, query: string) => fold(name).includes(fold(query));

// One fixed collation, so the server and every browser sort alike (the page is drawn on both).
const collator = new Intl.Collator("en");
/** A to Z by the name as written, then oldest first. */
const byName = (a: Person, b: Person) => collator.compare(a.name, b.name) || (a.birthYear ?? 0) - (b.birthYear ?? 0);

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
    .sort((a, b) => Number(starts(b)) - Number(starts(a)) || byName(a, b))
    .slice(0, limit);
}

/** ★ Everyone's views, in the switcher's order. */
export const EVERYONE_VIEWS = ["tree", "network", "wheel", "list"] as const;
export type EveryoneViewName = (typeof EVERYONE_VIEWS)[number];
export const isEveryoneView = (value: unknown): value is EveryoneViewName => EVERYONE_VIEWS.includes(value as EveryoneViewName);

/**
 * The view to open: the address's, else the one last used on this device (`saved`), else List on a
 * phone and Tree on anything bigger.
 */
export function chooseView(fromAddress: string | null, saved: string | null, phone: boolean): EveryoneViewName {
  if (isEveryoneView(fromAddress)) return fromAddress;
  if (isEveryoneView(saved)) return saved;
  return phone ? "list" : "tree";
}

/** ★ Everyone's address for a view, with the Wheel's middle and the selected person, so a link opens the same. */
export function everyoneHref(groupId: string, view: EveryoneViewName, personId?: string, centreId?: string): string {
  return `/g/${groupId}/s/${EVERYONE}?view=${view}${view === "wheel" && centreId ? `&centre=${centreId}` : ""}${personId ? `&person=${personId}` : ""}`;
}

/** One person in the List: their relations and the sheets that show them. */
export interface ListRow {
  person: Person;
  parents: Person[];
  partners: { person: Person; divorced: boolean }[];
  children: Person[];
  /** In tab order. */
  sheets: NamedSheet[];
  /** Joined the family by marriage: a partner, no parents added, and a partner whose parents are added. */
  marriedIn: boolean;
}

/**
 * The List (★ Everyone, part 2): everyone, A to Z by the name as written (the same name, oldest first).
 * Relations are the panel's (`relationsOf`), counting only people who are here; each sheet's view is
 * built once.
 */
export function listRows(tree: GroupTree): ListRow[] {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const people = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  const parentsOf = new Map<string, Person[]>();
  const couplesOf = new Map<string, GroupTree["unions"]>();
  for (const union of tree.unions) {
    for (const child of union.childIds) if (!parentsOf.has(child)) parentsOf.set(child, people(union.partnerIds));
    for (const partner of union.partnerIds) couplesOf.set(partner, [...(couplesOf.get(partner) ?? []), union]);
  }
  const sheetsOf = new Map<string, NamedSheet[]>();
  for (const sheet of tabOrder(tree.sheets)) {
    for (const p of buildSheetView(tree, sheet).persons) sheetsOf.set(p.id, [...(sheetsOf.get(p.id) ?? []), sheet]);
  }
  const hasParents = (id: string) => (parentsOf.get(id)?.length ?? 0) > 0;
  return [...tree.persons].sort(byName).map((person) => {
    const couples = couplesOf.get(person.id) ?? [];
    const partners = couples.flatMap((u) => people(u.partnerIds.filter((id) => id !== person.id)).map((p) => ({ person: p, divorced: u.status === "divorced" })));
    return {
      person,
      parents: parentsOf.get(person.id) ?? [],
      partners,
      children: couples.flatMap((u) => people(u.childIds)),
      sheets: sheetsOf.get(person.id) ?? [],
      marriedIn: partners.length > 0 && !hasParents(person.id) && partners.some((p) => hasParents(p.person.id)),
    };
  });
}

/** The List's filters, in order. */
export const LIST_FILTERS = [
  { id: "everyone", label: "Everyone", keep: () => true },
  { id: "living", label: "Living", keep: (row: ListRow) => row.person.deathYear === undefined },
  { id: "marriedIn", label: "Married in", keep: (row: ListRow) => row.marriedIn },
  { id: "noSheet", label: "On no sheet", keep: (row: ListRow) => row.sheets.length === 0 },
] as const;
export type ListFilter = (typeof LIST_FILTERS)[number]["id"];

/** The List's orders: A to Z (the default), or by birth date (an owner request). */
export const LIST_SORTS = [
  { id: "name", label: "A to Z" },
  { id: "oldest", label: "Oldest first" },
  { id: "youngest", label: "Youngest first" },
] as const;
export type ListSort = (typeof LIST_SORTS)[number]["id"];

/**
 * Rows in an order. By birth: full dates where known, a year alone before that year's dated days, and
 * people with no birth year last either way; otherwise A to Z, as the rows come.
 */
export function sortRows(rows: ListRow[], sort: ListSort): ListRow[] {
  if (sort === "name") return rows;
  const sign = sort === "oldest" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [x, y] = [birthOrder(a.person), birthOrder(b.person)];
    if (x === undefined || y === undefined) return Number(x === undefined) - Number(y === undefined);
    return sign * (x - y);
  });
}

/** The rows a filter keeps, narrowed to names containing what was typed. */
export function filterRows(rows: ListRow[], filter: ListFilter, query = ""): ListRow[] {
  const keep = LIST_FILTERS.find((f) => f.id === filter)!.keep;
  return rows.filter((row) => keep(row) && nameMatches(row.person.name, query));
}

const firstName = (p: Person) => p.name.split(" ")[0];

/**
 * The List's line under a name when it's narrow (phones): "Child of Olivia & Arjun", "♥ Sammie, Arham",
 * "3 children", with first names to fit. Empty for someone with no relations added.
 */
export function relationSummary(row: ListRow): string[] {
  const parts: string[] = [];
  if (row.parents.length) parts.push(`Child of ${row.parents.map(firstName).join(" & ")}`);
  if (row.partners.length) parts.push(`♥ ${row.partners.map((p) => firstName(p.person)).join(", ")}`);
  if (row.children.length) parts.push(`${row.children.length} ${row.children.length === 1 ? "child" : "children"}`);
  return parts;
}
