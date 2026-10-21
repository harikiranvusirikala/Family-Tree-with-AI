// GEDCOM 5.5.1 (F9, F10): the family file format Ancestry, FamilySearch and MyHeritage read and write.
// Persons are INDI records, couples FAM records. Pure: the browser parses imported files.
import type { Gender, GroupTree, NamedSheet, Union } from "@/tree/types";
import { datesProblem, isRealDate, lifeDates, marriageDate, type LifeDates } from "@/tree/years";
import { exportPart, MAX_IMPORT_PEOPLE, type ImportData, type ImportPerson } from "./types";

const GEDCOM_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A GEDCOM date: "12 MAR 1985" when the day and month are known (an owner request), else the year. */
function gedcomDate(year: number, month?: number, day?: number): string {
  return month !== undefined && day !== undefined ? `${day} ${GEDCOM_MONTHS[month - 1]} ${year}` : String(year);
}

const MIN_YEAR = 1000;
const MAX_YEAR = 2200;

/** "Priya Sharma" → "Priya /Sharma/": the last word as the surname. */
function gedcomName(name: string): string {
  const words = name.replaceAll("/", "-").trim().split(/\s+/);
  return words.length > 1 ? `${words.slice(0, -1).join(" ")} /${words.at(-1)}/` : words[0];
}

/** The group, or one sheet's part of it (§6), as a GEDCOM 5.5.1 file. Sheets don't exist in GEDCOM. */
export function exportGedcom(tree: GroupTree, sheet?: NamedSheet, now = new Date()): string {
  const { persons, unions } = exportPart(tree, sheet);
  const xref = new Map<string, string>([...persons.map((p, i) => [p.id, `@I${i + 1}@`] as const), ...unions.map((u, i) => [u.id, `@F${i + 1}@`] as const)]);
  const gender = new Map(persons.map((p) => [p.id, p.gender]));
  const date = now.toUTCString().split(" ").slice(1, 4).join(" ").toUpperCase(); // "19 OCT 2026"
  const lines = ["0 HEAD", "1 SOUR FAMILY_TREE_WITH_AI", "2 NAME Family Tree with AI", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8", `1 DATE ${date}`];

  for (const p of persons) {
    lines.push(`0 ${xref.get(p.id)} INDI`, `1 NAME ${gedcomName(p.name)}`, `1 SEX ${p.gender === "male" ? "M" : "F"}`);
    if (p.birthYear) lines.push("1 BIRT", `2 DATE ${gedcomDate(p.birthYear, p.birthMonth, p.birthDay)}`);
    if (p.deathYear) lines.push("1 DEAT", `2 DATE ${gedcomDate(p.deathYear, p.deathMonth, p.deathDay)}`);
    for (const u of unions) if (u.childIds.includes(p.id)) lines.push(`1 FAMC ${xref.get(u.id)}`);
    for (const u of unions) if (u.partnerIds.includes(p.id)) lines.push(`1 FAMS ${xref.get(u.id)}`);
  }
  for (const u of unions) {
    lines.push(`0 ${xref.get(u.id)} FAM`);
    // Men as HUSB and women as WIFE; a same-sex couple gets two of one, which the major programs read.
    for (const partner of u.partnerIds) lines.push(`1 ${gender.get(partner) === "male" ? "HUSB" : "WIFE"} ${xref.get(partner)}`);
    for (const child of u.childIds) lines.push(`1 CHIL ${xref.get(child)}`);
    if (u.marriageYear) lines.push("1 MARR", `2 DATE ${gedcomDate(u.marriageYear, u.marriageMonth, u.marriageDay)}`);
    if (u.status === "divorced") lines.push("1 DIV Y");
  }
  lines.push("0 TRLR");
  return `${lines.join("\n")}\n`;
}

interface Node {
  tag: string;
  xref?: string;
  value: string;
  children: Node[];
}

/** Lines → records, with CONC/CONT joined into their parent's value. */
function records(text: string): Node[] {
  const top: Node[] = [];
  const stack: Node[] = [];
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)) {
    const m = /^\s*(\d+)\s+(?:(@[^@\s]+@)\s+)?(\S+)(?: (.*))?$/.exec(raw);
    if (!m) continue;
    const level = Number(m[1]);
    const node: Node = { tag: m[3].toUpperCase(), ...(m[2] && { xref: m[2] }), value: m[4] ?? "", children: [] };
    stack.length = Math.min(stack.length, level);
    const parent = stack[level - 1];
    if (node.tag === "CONC" && parent) parent.value += node.value;
    else if (node.tag === "CONT" && parent) parent.value += `\n${node.value}`;
    else if (level === 0) top.push(node);
    else if (parent) parent.children.push(node);
    if (node.tag !== "CONC" && node.tag !== "CONT") stack[level] = node;
  }
  return top;
}

const child = (node: Node, tag: string) => node.children.find((c) => c.tag === tag);
const all = (node: Node, tag: string) => node.children.filter((c) => c.tag === tag);

/** The year in a GEDCOM date: "12 MAR 1985", "ABT 1900" and "BET 1900 AND 1910" give 1985, 1900, 1900. */
export function yearOf(date: string | undefined): number | undefined {
  for (const m of (date ?? "").matchAll(/\b(\d{3,4})\b/g)) {
    const year = Number(m[1]);
    if (year >= MIN_YEAR && year <= MAX_YEAR) return year;
  }
  return undefined;
}

/**
 * A GEDCOM date as a year, with the day and month when it's an exact date ("12 MAR 1985"). Approximate
 * dates ("ABT 1900", "BET 1900 AND 1910", "MAR 1985") give only their year.
 */
export function dateOf(date: string | undefined): { year?: number; month?: number; day?: number } {
  const exact = (date ?? "").trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/);
  if (exact) {
    const [day, month, year] = [Number(exact[1]), GEDCOM_MONTHS.indexOf(exact[2]) + 1, Number(exact[3])];
    if (month > 0 && year >= MIN_YEAR && year <= MAX_YEAR && isRealDate(year, month, day)) return { year, month, day };
  }
  const year = yearOf(date);
  return year === undefined ? {} : { year };
}

/** A date's value is kept whole: a year alone, or an exact day, month and year. */
const keptWhole = (value: string) => /^\s*\d{3,4}\s*$/.test(value) || dateOf(value).day !== undefined;

function nameOf(indi: Node): string {
  const name = child(indi, "NAME");
  const fromValue = (name?.value ?? "").replaceAll("/", " ").replace(/\s+/g, " ").trim();
  if (fromValue) return fromValue.slice(0, 120);
  const parts = [name && child(name, "GIVN")?.value, name && child(name, "SURN")?.value].filter(Boolean).join(" ").trim();
  return parts.slice(0, 120);
}

const KEPT = new Set(["NAME", "SEX", "BIRT", "DEAT", "FAMC", "FAMS", "HUSB", "WIFE", "CHIL", "MARR", "DIV", "DATE", "GIVN", "SURN", "_UID", "RIN", "CHAN", "PEDI", "NPFX", "NSFX", "SPFX", "NICK"]);

const NOT_KEPT = {
  places: "places",
  dates: "dates that aren't exact (only their years are kept)",
  notes: "notes",
  sources: "sources",
  media: "photos and other media",
  other: "other facts (such as occupations, burials and residences)",
} as const;

/** What the file had that the app doesn't keep, in plain words, always in the same order. */
function notKept(nodes: Node[]): string[] {
  const found = new Set<keyof typeof NOT_KEPT>();
  const walk = (node: Node) => {
    if (node.tag === "PLAC" || node.tag === "ADDR") found.add("places");
    else if (node.tag === "DATE" && !keptWhole(node.value)) found.add("dates");
    else if (node.tag === "NOTE") found.add("notes");
    else if (node.tag === "SOUR") found.add("sources");
    else if (node.tag === "OBJE") found.add("media");
    else if (!KEPT.has(node.tag)) found.add("other");
    node.children.forEach(walk);
  };
  for (const record of nodes) if (record.tag === "INDI" || record.tag === "FAM") record.children.forEach(walk);
  return (Object.keys(NOT_KEPT) as (keyof typeof NOT_KEPT)[]).filter((key) => found.has(key)).map((key) => NOT_KEPT[key]);
}

/** A GEDCOM file's people and couples, or the reason it can't be imported. `fileName` names a new group. */
export function parseGedcom(text: string, fileName = ""): ImportData | string {
  const nodes = records(text);
  if (!nodes.some((n) => n.tag === "HEAD") || !nodes.some((n) => n.tag === "INDI")) return "This isn't a GEDCOM file with people in it.";
  const warnings: string[] = [];
  const charset = child(nodes.find((n) => n.tag === "HEAD")!, "CHAR")?.value.toUpperCase();
  if (charset && !["UTF-8", "UTF8", "ASCII", "UNICODE"].includes(charset)) {
    warnings.push(`The file uses the ${charset} character set, so accented letters may look wrong. Export it again as UTF-8 if you can.`);
  }

  const indis = nodes.filter((n) => n.tag === "INDI" && n.xref);
  if (indis.length > MAX_IMPORT_PEOPLE) return `This file has ${indis.length} people; the limit is ${MAX_IMPORT_PEOPLE}. Split it into smaller files.`;
  let unnamed = 0;
  let badDeath = 0;
  const persons: ImportPerson[] = indis.map((indi) => {
    const sex = child(indi, "SEX")?.value.trim().toUpperCase();
    const gender: Gender | null = sex === "M" ? "male" : sex === "F" ? "female" : null;
    const birth = child(indi, "BIRT");
    const death = child(indi, "DEAT");
    const born = dateOf(birth && child(birth, "DATE")?.value);
    const died = dateOf(death && child(death, "DATE")?.value);
    let dates: LifeDates = lifeDates({ birthYear: born.year, birthMonth: born.month, birthDay: born.day, deathYear: died.year, deathMonth: died.month, deathDay: died.day });
    if (datesProblem(dates)) {
      // A death before the birth: the death is left out.
      dates = lifeDates({ birthYear: born.year, birthMonth: born.month, birthDay: born.day });
      badDeath++;
    }
    let name = nameOf(indi);
    if (!name) {
      name = "Unknown";
      unnamed++;
    }
    return { id: indi.xref!, name, gender, ...dates };
  });
  if (unnamed) warnings.push(`${unnamed} ${unnamed === 1 ? "person has" : "people have"} no name and ${unnamed === 1 ? "is" : "are"} imported as "Unknown".`);
  if (badDeath) warnings.push(`${badDeath} death ${badDeath === 1 ? "date was" : "dates were"} before the birth and ${badDeath === 1 ? "was" : "were"} left out.`);

  // A child in two families stays with their birth family if the file says which, otherwise the first.
  const known = new Set(persons.map((p) => p.id));
  const birthFamily = new Map<string, string>();
  for (const indi of indis) {
    const famcs = all(indi, "FAMC");
    const birth = famcs.find((f) => /birth/i.test(child(f, "PEDI")?.value ?? "")) ?? famcs[0];
    if (famcs.length > 1 && birth) birthFamily.set(indi.xref!, birth.value.trim());
  }
  const parentsOf = new Map<string, string>();
  const byCouple = new Map<string, Union>();
  const unions: Union[] = [];
  let noPartners = 0;
  let twoFamilies = 0;
  let sameCouple = 0;
  for (const fam of nodes.filter((n) => n.tag === "FAM" && n.xref)) {
    const partners = [...new Set([...all(fam, "HUSB"), ...all(fam, "WIFE")].map((n) => n.value.trim()).filter((x) => known.has(x)))].slice(0, 2);
    const children = all(fam, "CHIL").map((n) => n.value.trim()).filter((x) => known.has(x) && !partners.includes(x));
    if (partners.length === 0) {
      if (children.length) noPartners++;
      continue;
    }
    const key = [...partners].sort().join("+");
    const existing = byCouple.get(key);
    if (existing) sameCouple++;
    // When they married: an exact date whole, or only the year of an approximate one (as for births).
    const marriage = child(fam, "MARR");
    const on = partners.length === 2 ? dateOf(marriage && child(marriage, "DATE")?.value) : {};
    const married = marriageDate({ marriageYear: on.year, marriageMonth: on.month, marriageDay: on.day });
    const union: Union = existing ?? { id: fam.xref!, partnerIds: partners as Union["partnerIds"], status: child(fam, "DIV") ? "divorced" : "married", ...married, childIds: [] };
    for (const c of children) {
      const preferred = birthFamily.get(c);
      if (parentsOf.has(c) || (preferred && preferred !== fam.xref)) {
        if (parentsOf.get(c) !== union.id) twoFamilies++;
        continue;
      }
      parentsOf.set(c, union.id);
      if (!union.childIds.includes(c)) union.childIds.push(c);
    }
    if (!existing) {
      byCouple.set(key, union);
      unions.push(union);
    }
  }
  if (noPartners) warnings.push(`${noPartners} ${noPartners === 1 ? "family" : "families"} without parents ${noPartners === 1 ? "was" : "were"} skipped; their children are imported without parents.`);
  if (twoFamilies) warnings.push(`${twoFamilies} ${twoFamilies === 1 ? "child is" : "children are"} listed in two families; each stays with the first (or the birth family, where the file says).`);
  if (sameCouple) warnings.push(`${sameCouple} couple${sameCouple === 1 ? " was" : "s were"} listed twice and ${sameCouple === 1 ? "was" : "were"} joined.`);

  const suggestedName = fileName.replace(/\.(ged|gedcom)$/i, "").trim() || undefined;
  return { kind: "gedcom", persons, unions, sheets: [], warnings, notKept: notKept(nodes), ...(suggestedName && { suggestedName }) };
}
