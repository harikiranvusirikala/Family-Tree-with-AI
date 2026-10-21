// ★ Everyone's Wheel (part 4 of an owner request after the final check): how everyone in the group is
// related to one person. The shortest path of family steps from that person to each other one, then a
// name for it: Telugu relationship names written in English letters (the owner's choice, the default),
// or English names. Pure: the browser draws it, and unit tests check it.
import type { GroupTree, Person, Union } from "./types";
import { birthOrder } from "./years";

/** A family step: to a parent (U, up), a child (D, down), a brother or sister (S) or a partner (P). */
export type Move = "U" | "D" | "S" | "P";
export interface Step {
  move: Move;
  person: Person;
  /** A partner step through a divorced couple. */
  divorced?: boolean;
  /** A brother or sister with only one parent in common. */
  half?: boolean;
}

export interface Kin {
  person: Person;
  /** From the person in the middle; the last step reaches `person`. Its length is the number of steps. */
  path: Step[];
}

export interface Kinship {
  centre: Person;
  /** Everyone related, closest first. */
  relatives: Kin[];
  /** People not related to the middle through anyone (a family not joined to the rest). */
  unrelated: Person[];
}

export type NameStyle = "te" | "en";

/** Preferred among paths of the same length: blood relations before marriages, then up, across, down. */
const ORDER: Record<Move, number> = { U: 0, S: 1, D: 2, P: 3 };

/** The family steps from each person, from the loaded group (removed people are already left out). */
function familySteps(tree: GroupTree) {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const parentsUnion = new Map<string, Union>();
  const unionsOf = new Map<string, Union[]>();
  for (const union of tree.unions) {
    for (const child of union.childIds) if (!parentsUnion.has(child)) parentsUnion.set(child, union);
    for (const partner of union.partnerIds) unionsOf.set(partner, [...(unionsOf.get(partner) ?? []), union]);
  }
  const here = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  return (id: string): Step[] => {
    const steps: Step[] = [];
    const own = parentsUnion.get(id);
    const parents = here(own?.partnerIds ?? []);
    for (const parent of parents) steps.push({ move: "U", person: parent });
    // Brothers and sisters: anyone else with a parent in common (half when it's another couple's child).
    const seen = new Set([id]);
    for (const parent of parents) {
      for (const union of unionsOf.get(parent.id) ?? []) {
        for (const sibling of here(union.childIds)) {
          if (seen.has(sibling.id)) continue;
          seen.add(sibling.id);
          steps.push({ move: "S", person: sibling, half: union !== own });
        }
      }
    }
    for (const union of unionsOf.get(id) ?? []) for (const child of here(union.childIds)) steps.push({ move: "D", person: child });
    for (const union of unionsOf.get(id) ?? []) {
      for (const partner of here(union.partnerIds.filter((p) => p !== id))) steps.push({ move: "P", person: partner, divorced: union.status === "divorced" });
    }
    return steps;
  };
}

/**
 * How much a path goes through marriages: a partner step counts one, a half-brother or half-sister two
 * (through another couple, and less direct: a wife's son is a stepson before he's a son's half-brother).
 */
const marriageSteps = (path: Step[]) => path.reduce((n, s) => n + (s.move === "P" ? 1 : s.half ? 2 : 0), 0);
const pathKey = (path: Step[]) => path.map((s) => ORDER[s.move]).join("");

/** Below zero when `a` is a better way to reach someone than `b` (both the same length). */
function better(a: Step[], b: Step[]) {
  const via = (path: Step[]) => path[path.length - 2]?.person.id ?? ""; // the relative just before, so ties always break the same way
  return marriageSteps(a) - marriageSteps(b) || pathKey(a).localeCompare(pathKey(b)) || via(a).localeCompare(via(b));
}

/**
 * How everyone is related to `centreId`: the shortest path to each person, one ring of the wheel per
 * step, where a parent, partner, child, brother or sister is one step. Among paths of the same length,
 * the one with fewer marriages wins, so names follow blood where they can.
 */
export function kinship(tree: GroupTree, centreId: string): Kinship {
  const centre = tree.persons.find((p) => p.id === centreId) ?? tree.persons[0];
  const stepsFrom = familySteps(tree);
  const paths = new Map<string, Step[]>([[centre.id, []]]);
  let layer = [centre.id];
  while (layer.length) {
    const next = new Map<string, Step[]>();
    for (const id of layer) {
      for (const step of stepsFrom(id)) {
        if (paths.has(step.person.id)) continue;
        const path = [...paths.get(id)!, step];
        const known = next.get(step.person.id);
        if (!known || better(path, known) < 0) next.set(step.person.id, path);
      }
    }
    for (const [id, path] of next) paths.set(id, path);
    layer = [...next.keys()].sort();
  }
  const relatives = tree.persons
    .filter((p) => p.id !== centre.id && paths.has(p.id))
    .map((person) => ({ person, path: paths.get(person.id)! }))
    .sort((a, b) => a.path.length - b.path.length || (a.person.birthYear ?? 0) - (b.person.birthYear ?? 0) || a.person.name.localeCompare(b.person.name));
  return { centre, relatives, unrelated: tree.persons.filter((p) => !paths.has(p.id)) };
}

// ---- Names ----

const pattern = (steps: Step[]) => steps.map((s) => s.move).join("");
const male = (p: Person) => p.gender === "male";
/**
 * True when `a` is older than `b`, false when younger, null when it can't be told: a birth year missing,
 * or the same year without both full dates (or with the same date).
 */
function elder(a: Person, b: Person): boolean | null {
  if (a.birthYear === undefined || b.birthYear === undefined) return null;
  if (a.birthYear !== b.birthYear) return a.birthYear < b.birthYear;
  if (a.birthMonth === undefined || b.birthMonth === undefined) return null;
  const [x, y] = [birthOrder(a)!, birthOrder(b)!];
  return x === y ? null : x < y;
}
/** The elder or younger name; both ("Annayya/Thammudu") when the birth years don't tell. */
function byAge(a: Person, b: Person, elderName: string, youngerName: string) {
  const older = elder(a, b);
  return older === null ? `${elderName}/${youngerName}` : older ? elderName : youngerName;
}
const sibling = (t: Person, ref: Person) => (male(t) ? byAge(t, ref, "Annayya", "Thammudu") : byAge(t, ref, "Akka", "Chelli"));
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
const ordinal = (n: number) => (n === 2 ? "Second" : n === 3 ? "Third" : `${n}th`);

/** "Grandmother", "Great-grandfather", "2× great-grandmother": `generations` up (or down, with the child words). */
function generationWord(generations: number, base: string) {
  if (generations === 1) return base;
  if (generations === 2) return `Grand${lower(base)}`;
  if (generations === 3) return `Great-grand${lower(base)}`;
  return `${generations - 2}× great-grand${lower(base)}`;
}

/** The English name of one stretch of a path that starts at `from`, or null if it has none of its own. */
function englishName(from: Person, steps: Step[]): string | null {
  const p = pattern(steps);
  const t = steps[steps.length - 1].person;
  const m = male(t);
  const divorced = steps.some((s) => s.divorced);
  const ups = p.match(/^U*/)![0].length;
  const downs = p.match(/D*$/)![0].length;
  if (/^U+$/.test(p)) return generationWord(ups, m ? "Father" : "Mother");
  if (/^D+$/.test(p)) return generationWord(downs, m ? "Son" : "Daughter");
  if (p === "P") return divorced ? (m ? "Ex-husband" : "Ex-wife") : m ? "Husband" : "Wife";
  if (p === "S") return steps[0].half ? (m ? "Half-brother" : "Half-sister") : m ? "Brother" : "Sister";
  if (/^U+S$/.test(p)) {
    const word = m ? "uncle" : "aunt";
    return ups === 1 ? (m ? "Uncle" : "Aunt") : ups === 2 ? `Great-${word}` : ups === 3 ? `Great-great-${word}` : `${ups - 1}× great-${word}`;
  }
  if (/^SD+$/.test(p)) return generationWord(downs, m ? "Nephew" : "Niece");
  if (/^U+SD+$/.test(p)) {
    const degree = Math.min(ups, downs);
    const removed = Math.abs(ups - downs);
    const cousin = degree === 1 ? "Cousin" : `${ordinal(degree)} cousin`;
    if (removed === 0) return cousin;
    if (downs > ups) return `${cousin}'s ${lower(generationWord(removed, m ? "Son" : "Daughter"))}`;
    const via = steps[removed - 1].person; // the ancestor whose cousin this is
    return `${generationWord(removed, male(via) ? "Father" : "Mother")}'s ${lower(cousin)}`;
  }
  if (divorced) return null; // "Son's ex-wife" reads better than an in-law word
  if (p === "PU") return m ? "Father-in-law" : "Mother-in-law";
  if (p === "DP") return m ? "Son-in-law" : "Daughter-in-law";
  if (p === "PS" || p === "SP") return m ? "Brother-in-law" : "Sister-in-law";
  if (p === "UP") return m ? "Stepfather" : "Stepmother";
  if (p === "PD") return m ? "Stepson" : "Stepdaughter";
  if (p === "UPD") return m ? "Stepbrother" : "Stepsister";
  return null;
}

/** The Telugu name (in English letters) of one stretch of a path that starts at `from`, or null. */
function teluguName(from: Person, steps: Step[]): string | null {
  const p = pattern(steps);
  const t = steps[steps.length - 1].person;
  const m = male(t);
  const divorced = steps.some((s) => s.divorced);
  if (p === "U") return m ? "Nanna" : "Amma";
  if (p === "UU") return m ? "Thathayya" : male(steps[0].person) ? "Nannamma" : "Ammamma";
  if (p === "UUU") return m ? "Muthathayya" : "Muthavva";
  if (p === "D") return m ? "Koduku" : "Kuthuru";
  if (p === "DD") return m ? "Manavadu" : "Manavaralu";
  if (p === "DDD") return m ? "Munimanavadu" : "Munimanavaralu";
  if (p === "P") return divorced ? (m ? "Maaji bhartha" : "Maaji bharya") : m ? "Bhartha" : "Bharya";
  if (p === "S") return sibling(t, from);
  if (p === "US") {
    const parent = steps[0].person;
    if (male(parent)) return m ? byAge(t, parent, "Peddananna", "Babai") : "Attha";
    return m ? "Menamama" : byAge(t, parent, "Peddamma", "Pinni");
  }
  if (p === "SD") {
    // A man's sister's children, a woman's brother's: their own children's words are for the others.
    return male(steps[0].person) !== male(from) ? (m ? "Menalludu" : "Menakodalu") : null;
  }
  if (p === "USD") {
    const [parent, uncle] = [steps[0].person, steps[1].person];
    if (male(parent) === male(uncle)) return sibling(t, from); // a father's brother's, a mother's sister's: like brothers and sisters
    return m ? byAge(t, from, "Bava", "Bavamaridi") : byAge(t, from, "Vadina", "Maradalu");
  }
  if (divorced) return null;
  if (p === "PU") return m ? "Mavayya" : "Attha";
  if (p === "DP") return m ? "Alludu" : "Kodalu";
  if (p === "USP") {
    const [parent, between] = [steps[0].person, steps[1].person];
    if (male(parent) && male(between) && !m) return byAge(between, parent, "Peddamma", "Pinni"); // father's brother's wife
    if (male(parent) && !male(between) && m) return "Mavayya"; // father's sister's husband
    if (!male(parent) && !male(between) && m) return byAge(between, parent, "Peddananna", "Babai"); // mother's sister's husband
    if (!male(parent) && male(between) && !m) return "Attha"; // mother's brother's wife
    return null;
  }
  if (p === "SP") {
    const between = steps[0].person;
    if (male(between) && !m) return byAge(between, from, "Vadina", "Maradalu"); // a brother's wife
    if (!male(between) && m) return byAge(between, from, "Bava", "Bavamaridi"); // a sister's husband
    return null;
  }
  if (p === "PS") {
    const partner = steps[0].person;
    return m ? byAge(t, partner, "Bava", "Bavamaridi") : byAge(t, partner, "Vadina", "Maradalu");
  }
  if (p === "PSP") {
    const [partner, between] = [steps[0].person, steps[1].person];
    if (!male(from) && male(partner) && male(between) && !m) return "Thodikodalu"; // husband's brother's wife
    if (male(from) && !male(partner) && !male(between) && m) return "Thodalludu"; // wife's sister's husband
    return null;
  }
  return null;
}

/** Stretches that are in-law or step names: a chain avoids them where blood names do as well. */
const BY_MARRIAGE = new Set(["PU", "DP", "PS", "SP", "PSP", "UP", "PD", "UPD"]);
const MAX_PARTS = 3;

/**
 * The name of how someone is related to the person in the middle: a name of its own (Babai, Cousin), or
 * a chain of up to three ("Uncle's wife"; "Menalludu bharya" in Telugu, words side by side), else
 * "Relative" (Bandhuvu). Among chains, Telugu prefers the fewest parts (Thodalludu's words are what
 * families say), English the fewest in-law words ("Wife's sister's husband", not the ambiguous
 * "Sister-in-law's husband"); then the longer first part.
 */
export function relationName(centre: Person, path: Step[], style: NameStyle): string {
  const nameOf = style === "te" ? teluguName : englishName;
  type Chain = { parts: string[]; marriage: number; first: number };
  const score = (c: Chain) => (style === "te" ? [c.parts.length, c.marriage, -c.first] : [Number(c.parts.length > 1), c.marriage, c.parts.length, -c.first]);
  const beats = (a: Chain, b: Chain) => {
    const [x, y] = [score(a), score(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  // best[i][k]: the best chain of k parts for the path from step i to the end.
  const best: (Chain | null)[][] = Array.from({ length: path.length + 1 }, () => Array<Chain | null>(MAX_PARTS + 1).fill(null));
  best[path.length][0] = { parts: [], marriage: 0, first: 0 };
  for (let i = path.length - 1; i >= 0; i--) {
    const from = i === 0 ? centre : path[i - 1].person;
    for (let j = path.length; j > i; j--) {
      const name = nameOf(from, path.slice(i, j));
      if (!name) continue;
      for (let k = 0; k < MAX_PARTS; k++) {
        const rest = best[j][k];
        if (!rest) continue;
        const candidate = { parts: [name, ...rest.parts], marriage: rest.marriage + Number(BY_MARRIAGE.has(pattern(path.slice(i, j)))), first: j - i };
        const known = best[i][k + 1];
        if (!known || beats(candidate, known) < 0) best[i][k + 1] = candidate;
      }
    }
  }
  const chain = best[0].filter((c): c is Chain => c !== null).sort(beats)[0];
  if (!chain) return style === "te" ? "Bandhuvu" : "Relative";
  const [first, ...rest] = chain.parts;
  return style === "te" ? [first, ...rest.map(lower)].join(" ") : [first, ...rest.map(lower)].join("'s ");
}

/** The exact path in English, for the panel: "father's elder brother", "wife's younger sister's husband". */
export function relationPath(centre: Person, path: Step[]): string {
  return path
    .map((step, i) => {
      const t = step.person;
      const m = male(t);
      if (step.move === "U") return m ? "father" : "mother";
      if (step.move === "D") return m ? "son" : "daughter";
      if (step.move === "P") return `${step.divorced ? "ex-" : ""}${m ? "husband" : "wife"}`;
      const older = elder(t, i === 0 ? centre : path[i - 1].person);
      return `${older === null ? "" : older ? "elder " : "younger "}${step.half ? "half-" : ""}${m ? "brother" : "sister"}`;
    })
    .join("'s ");
}

/** The wheel's summary groups, in order. */
export const KIN_GROUPS = [
  { id: "parents", label: "Parents" },
  { id: "partners", label: "Wives and husbands" },
  { id: "children", label: "Children" },
  { id: "siblings", label: "Brothers and sisters" },
  { id: "grandparents", label: "Grandparents" },
  { id: "grandchildren", label: "Grandchildren" },
  { id: "auntsUncles", label: "Aunts and uncles" },
  { id: "niecesNephews", label: "Nieces and nephews" },
  { id: "cousins", label: "Cousins" },
  { id: "inLaws", label: "In-laws" },
  { id: "stepFamily", label: "Step-family" },
  { id: "others", label: "Others" },
] as const;
export type KinGroup = (typeof KIN_GROUPS)[number]["id"];

export function kinGroup(path: Step[]): KinGroup {
  const p = pattern(path);
  if (p === "U") return "parents";
  if (p === "P") return "partners";
  if (p === "D") return "children";
  if (p === "S") return "siblings";
  if (/^U{2,}$/.test(p)) return "grandparents";
  if (/^D{2,}$/.test(p)) return "grandchildren";
  if (/^U+SP?$/.test(p)) return "auntsUncles"; // and their wives and husbands (Attha, Pinni)
  if (/^SD+$/.test(p)) return "niecesNephews";
  if (/^U+SD+$/.test(p)) return "cousins";
  if (["PU", "DP", "PS", "SP", "PSP"].includes(p)) return "inLaws";
  if (["UP", "PD", "UPD"].includes(p)) return "stepFamily";
  return "others";
}

/** Where on the wheel: ancestors up, descendants down, partners and their families right, the rest left. */
export type Side = "up" | "right" | "down" | "left";
export function kinSide(path: Step[]): Side {
  const p = pattern(path);
  if (p.startsWith("P")) return "right";
  if (p.startsWith("D")) return "down";
  if (/^U+P?$/.test(p)) return "up"; // parents, grandparents, and their partners (step-parents)
  return "left";
}
