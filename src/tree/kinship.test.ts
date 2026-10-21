// @vitest-environment node
import { describe, expect, test } from "vitest";
import { sampleState, toGroupTree } from "@test/planning";
import type { Gender, GroupTree, Person, Union } from "./types";
import { kinGroup, kinship, kinSide, relationName, relationPath, type Kinship, type Step } from "./kinship";

/** Each person's names from the middle, "Telugu | English", by name and by "name year" (names repeat). */
function names(k: Kinship): Record<string, string> {
  return Object.fromEntries(
    k.relatives.flatMap((r) => {
      const both = `${relationName(k.centre, r.path, "te")} | ${relationName(k.centre, r.path, "en")}`;
      return [[r.person.name, both], [`${r.person.name} ${r.person.birthYear}`, both]];
    }),
  );
}

const sample = toGroupTree(sampleState());
const fromSample = (name: string) => kinship(sample, sample.persons.find((p) => p.name === name)!.id);

describe("the Wheel's relations, from Steve Cruz in the sample (owner request)", () => {
  const k = fromSample("Steve Cruz");
  const n = names(k);

  test("everyone else is related, closest first, one step for a parent, partner, child, brother or sister", () => {
    expect(k.relatives).toHaveLength(35);
    expect(k.unrelated).toEqual([]);
    expect(k.relatives.slice(0, 7).map((r) => r.person.name)).toEqual(["Olivia Cruz", "Arjun Patel", "Arham Chopra", "Sammie Chang", "William Cruz", "Taylor Cruz", "Anna Cruz"]);
    expect(k.relatives.map((r) => r.path.length)).toEqual([...k.relatives.map((r) => r.path.length)].sort((a, b) => a - b));
  });

  test("Telugu names, in English letters, and English names", () => {
    expect(n["Olivia Cruz"]).toBe("Amma | Mother");
    expect(n["Arjun Patel"]).toBe("Nanna | Father");
    expect(n["Arham Chopra"]).toBe("Bharya | Wife");
    expect(n["Sammie Chang"]).toBe("Maaji bharya | Ex-wife");
    expect(n["Anna Cruz"]).toBe("Kuthuru | Daughter");
    expect(n["Alexander Cruz"]).toBe("Thathayya | Grandfather"); // his mother's fathers, a same-sex couple
    expect(n["Jake Cruz"]).toBe("Menamama | Uncle"); // his mother's brother
    expect(n["Taylor Humes"]).toBe("Attha | Uncle's wife");
    expect(n["Christina Cruz"]).toBe("Vadina | Cousin"); // a mother's brother's daughter, older than him
    expect(n["Maria Young"]).toBe("Maradalu | Cousin"); // younger
    expect(n["Cullen Cruz"]).toBe("Bava | Cousin");
    expect(n["Jane Howell"]).toBe("Kodalu | Daughter-in-law");
    expect(n["Alex Cruz"]).toBe("Manavadu | Grandson");
    expect(n["Amy Harolds"]).toBe("Muthavva | Great-grandmother");
    expect(n["Timothy Young 1970"]).toBe("Vadina bhartha | Cousin's husband"); // Christina's husband
    expect(n["Margaret Yap"]).toBe("Attha amma | Uncle's wife's mother"); // English chains avoid in-law words
    expect(n["Carlo Young"]).toBe("Vadina koduku | Cousin's son");
  });

  test("the exact path, for the panel, says which side and who is elder", () => {
    const of = (name: string) => k.relatives.find((r) => r.person.name === name)!;
    expect(relationPath(k.centre, of("Jake Cruz").path)).toBe("mother's elder brother");
    expect(relationPath(k.centre, of("Sammie Chang").path)).toBe("ex-wife");
    expect(relationPath(k.centre, of("Margaret Yap").path)).toBe("mother's elder brother's wife's mother");
  });

  test("groups and sides", () => {
    const of = (name: string) => k.relatives.find((r) => r.person.name === name)!.path;
    expect(["Olivia Cruz", "Arham Chopra", "William Cruz", "Alexander Cruz", "Alex Cruz", "Jake Cruz", "Taylor Humes", "Christina Cruz", "Jane Howell", "Timothy Young"].map((name) => kinGroup(of(name)))).toEqual([
      "parents", "partners", "children", "grandparents", "grandchildren", "auntsUncles", "auntsUncles", "cousins", "inLaws", "others",
    ]);
    expect(["Olivia Cruz", "Amy Harolds", "Arham Chopra", "William Cruz", "Jane Howell", "Jake Cruz", "Christina Cruz"].map((name) => kinSide(of(name)))).toEqual(["up", "up", "right", "down", "down", "left", "left"]);
  });

  test("a family not joined to the rest isn't related", () => {
    const zoe: Person = { id: "z".repeat(24), name: "Zoë Ávila", gender: "female" };
    expect(kinship({ ...sample, persons: [...sample.persons, zoe] }, sample.persons[0].id).unrelated).toEqual([zoe]);
  });
});

// A made-up family for what the sample doesn't have: the father's elder and younger brothers, the mother's
// sisters, parallel and cross cousins, half- and step-family, in-laws on both sides, unknown ages.
function family(): GroupTree {
  const persons: Person[] = [];
  const unions: Union[] = [];
  const people: [string, Gender, number?][] = [
    ["Thatha's father", "male", 1900], ["Thatha", "male", 1930], ["Thatha's brother", "male", 1934], ["Nannamma", "female", 1932],
    ["Ammamma", "female", 1935], ["Ammamma's husband", "male", 1931], ["Second cousin's parent", "female", 1962], ["Second cousin", "male", 1990],
    ["Dad", "male", 1960], ["Dad's elder brother", "male", 1955], ["Dad's younger brother", "male", 1965], ["Dad's sister", "female", 1962], ["Dad's brother, no year", "male"],
    ["Mum", "female", 1963], ["Mum's elder sister", "female", 1958], ["Mum's younger sister", "female", 1968], ["Mum's brother", "male", 1966],
    ["Elder brother's wife", "female", 1956], ["Younger brother's wife", "female", 1967], ["Sister's husband", "male", 1960],
    ["Elder sister's husband", "male", 1957], ["Younger sister's husband", "male", 1966], ["Brother's wife", "female", 1968],
    ["Cousin A", "male", 1985], ["Cousin B", "female", 1995], ["Cousin C", "male", 1992], ["Cousin D", "female", 1980],
    ["Ego", "male", 1990], ["Elder sister", "female", 1987], ["Younger brother", "male", 1993], ["Thammudu's wife", "female", 1994], ["Brother's son", "male", 2020],
    ["Wife", "female", 1992], ["Wife's father", "male", 1960], ["Wife's mother", "female", 1962], ["Wife's elder brother", "male", 1988], ["Wife's younger sister", "female", 1995], ["Her husband", "male", 1994],
    ["Bava's father", "male", 1955], ["Bava", "male", 1985], ["His brother", "male", 1983], ["His brother's wife", "female", 1986], ["Sister's daughter", "female", 2012],
    ["Son", "male", 2015], ["Son's wife", "female", 2016], ["Grandchild", "female", 2040],
    ["Dad's ex-wife", "female", 1961], ["Half-brother", "male", 1986], ["Wife's ex-husband", "male", 1990], ["Stepson", "male", 2012],
  ];
  for (const [id, gender, birthYear] of people) persons.push({ id, name: id, gender, birthYear });
  const couple = (partnerIds: [string, string] | [string], childIds: string[], status: Union["status"] = "married") => unions.push({ id: `u${unions.length}`, partnerIds, status, childIds });
  couple(["Thatha's father"], ["Thatha", "Thatha's brother"]);
  couple(["Thatha's brother"], ["Second cousin's parent"]);
  couple(["Second cousin's parent"], ["Second cousin"]);
  couple(["Thatha", "Nannamma"], ["Dad", "Dad's elder brother", "Dad's younger brother", "Dad's sister", "Dad's brother, no year"]);
  couple(["Ammamma's husband", "Ammamma"], ["Mum", "Mum's elder sister", "Mum's younger sister", "Mum's brother"]);
  couple(["Dad", "Mum"], ["Ego", "Elder sister", "Younger brother"]);
  couple(["Dad", "Dad's ex-wife"], ["Half-brother"], "divorced");
  couple(["Dad's elder brother", "Elder brother's wife"], ["Cousin A"]);
  couple(["Dad's younger brother", "Younger brother's wife"], []);
  couple(["Dad's sister", "Sister's husband"], ["Cousin B"]);
  couple(["Mum's elder sister", "Elder sister's husband"], ["Cousin D"]);
  couple(["Mum's younger sister", "Younger sister's husband"], []);
  couple(["Mum's brother", "Brother's wife"], ["Cousin C"]);
  couple(["Ego", "Wife"], ["Son"]);
  couple(["Wife", "Wife's ex-husband"], ["Stepson"], "divorced");
  couple(["Wife's father", "Wife's mother"], ["Wife", "Wife's elder brother", "Wife's younger sister"]);
  couple(["Wife's younger sister", "Her husband"], []);
  couple(["Bava's father"], ["Bava", "His brother"]);
  couple(["Elder sister", "Bava"], ["Sister's daughter"]);
  couple(["His brother", "His brother's wife"], []);
  couple(["Younger brother", "Thammudu's wife"], ["Brother's son"]);
  couple(["Son", "Son's wife"], ["Grandchild"]);
  return { persons, unions, sheets: [] };
}

describe("the Wheel's relations: Telugu names that depend on age, side and gender (owner request)", () => {
  const tree = family();
  const n = names(kinship(tree, "Ego"));
  const te = (name: string) => n[name].split(" | ")[0];
  const en = (name: string) => n[name].split(" | ")[1];

  test("brothers and sisters by age; a half-brother", () => {
    expect([te("Elder sister"), te("Younger brother")]).toEqual(["Akka", "Thammudu"]);
    expect(n["Half-brother"]).toBe("Annayya | Half-brother");
  });

  test("grandmothers by side", () => {
    expect([te("Nannamma"), te("Ammamma")]).toEqual(["Nannamma", "Ammamma"]);
  });

  test("the father's elder and younger brothers and their wives; his sister and her husband", () => {
    expect([te("Dad's elder brother"), te("Dad's younger brother"), te("Elder brother's wife"), te("Younger brother's wife")]).toEqual(["Peddananna", "Babai", "Peddamma", "Pinni"]);
    expect([te("Dad's sister"), te("Sister's husband")]).toEqual(["Attha", "Mavayya"]);
    expect(te("Dad's brother, no year")).toBe("Peddananna/Babai"); // no birth year: both
  });

  test("the mother's sisters and their husbands; her brother and his wife", () => {
    expect([te("Mum's elder sister"), te("Mum's younger sister"), te("Elder sister's husband"), te("Younger sister's husband")]).toEqual(["Peddamma", "Pinni", "Peddananna", "Babai"]);
    expect([te("Mum's brother"), te("Brother's wife")]).toEqual(["Menamama", "Attha"]);
    expect([en("Mum's brother"), en("Brother's wife"), en("Sister's husband")]).toEqual(["Uncle", "Uncle's wife", "Aunt's husband"]);
  });

  test("parallel cousins are like brothers and sisters, cross cousins are Bava, Bavamaridi, Vadina, Maradalu", () => {
    expect([te("Cousin A"), te("Cousin D")]).toEqual(["Annayya", "Akka"]); // father's brother's son, mother's sister's daughter
    expect([te("Cousin B"), te("Cousin C")]).toEqual(["Maradalu", "Bavamaridi"]); // father's sister's daughter, mother's brother's son
    expect(en("Cousin A")).toBe("Cousin");
  });

  test("in-laws", () => {
    expect([te("Wife's father"), te("Wife's mother"), te("Wife's elder brother"), te("Wife's younger sister")]).toEqual(["Mavayya", "Attha", "Bava", "Maradalu"]);
    expect([te("Her husband"), en("Her husband")]).toEqual(["Thodalludu", "Wife's sister's husband"]);
    expect([te("Bava"), te("Son's wife")]).toEqual(["Bava", "Kodalu"]);
    expect(en("Wife's elder brother")).toBe("Brother-in-law");
  });

  test("a man's sister's daughter is Menakodalu; his brother's son is Thammudu koduku", () => {
    expect(n["Sister's daughter"]).toBe("Menakodalu | Niece");
    expect(n["Brother's son"]).toBe("Thammudu koduku | Nephew");
  });

  test("step-family and divorces read as chains in Telugu", () => {
    expect(n["Stepson"]).toBe("Bharya koduku | Stepson");
    expect(n["Dad's ex-wife"]).toBe("Nanna maaji bharya | Father's ex-wife");
    expect(n["Wife's ex-husband"]).toBe("Bharya maaji bhartha | Wife's ex-husband");
  });

  test("further family: a great-uncle, a second cousin, a grandchild", () => {
    expect(n["Thatha's brother"]).toBe("Thathayya thammudu | Great-uncle");
    expect(n["Second cousin"]).toBe("Thathayya thammudu manavadu | Second cousin");
    expect(n["Grandchild"]).toBe("Manavaralu | Granddaughter");
  });

  test("from a woman: her brother's son is Menalludu; her husband's brother's wife is Thodikodalu", () => {
    const hers = names(kinship(tree, "Elder sister"));
    expect(hers["Brother's son"].split(" | ")[0]).toBe("Menalludu");
    expect(hers["His brother's wife"]).toBe("Thodikodalu | Husband's brother's wife");
    expect(hers["Sister's daughter"]).toBe("Kuthuru | Daughter"); // her own daughter
  });

  test("a chain longer than three names is a relative", () => {
    const person = (id: string, gender: Gender): Person => ({ id, name: id, gender });
    const path: Step[] = ["P", "U", "P", "U", "P", "U", "P"].map((move, i) => ({ move: move as Step["move"], person: person(`p${i}`, i % 2 ? "male" : "female") }));
    expect([relationName(person("me", "male"), path, "te"), relationName(person("me", "male"), path, "en")]).toEqual(["Bandhuvu", "Relative"]);
  });

  test("great-great-grandparents", () => {
    const people = ["me", "f1", "f2", "f3", "f4"].map((id, i) => ({ id, name: id, gender: "male" as const, birthYear: 2000 - 30 * i }));
    const unions: Union[] = people.slice(1).map((p, i) => ({ id: `u${i}`, partnerIds: [p.id], status: "married", childIds: [people[i].id] }));
    const k = kinship({ persons: people, unions, sheets: [] }, "me");
    expect(names(k)["f4"]).toBe("Muthathayya nanna | 2× great-grandfather");
  });
});
