// The family from samples/Sample Family Tree.png: 36 people over 6 generations.
// Invented data. It covers a same-sex couple (Alexander Cruz + Jerry Willow), a divorce and
// remarriage (Steve Cruz with Sammie Chang, then Arham Chopra) and in-law parents
// (Cynthia Willow + Fred Lambert, Margaret Yap + Nick Young). Some couples have a marriage date: a
// full one (Jake and Taylor, Steve and Arham) or only the year.
import type { FamilyData, Person, Sheet, Union } from "@/tree/types";
import type { MarriageDate } from "@/tree/years";

const m = (id: string, name: string, birthYear: number, deathYear?: number): Person => ({
  id, name, gender: "male", birthYear, ...(deathYear ? { deathYear } : {}),
});
const f = (id: string, name: string, birthYear: number, deathYear?: number): Person => ({
  id, name, gender: "female", birthYear, ...(deathYear ? { deathYear } : {}),
});

export const persons: Person[] = [
  // Generation 1
  m("timothy-cruz-1880", "Timothy Cruz", 1880, 1962),
  f("amy-harolds", "Amy Harolds", 1885, 1966),
  f("cynthia-willow", "Cynthia Willow", 1899, 1950),
  m("fred-lambert", "Fred Lambert", 1890, 1977),
  // Generation 2
  m("alexander-cruz", "Alexander Cruz", 1918, 2003),
  m("jerry-willow", "Jerry Willow", 1920, 1989),
  f("margaret-yap", "Margaret Yap", 1912, 2010),
  m("nick-young", "Nick Young", 1908, 1991),
  // Generation 3
  m("jake-cruz", "Jake Cruz", 1945, 2022),
  f("taylor-humes", "Taylor Humes", 1955),
  f("olivia-cruz", "Olivia Cruz", 1960),
  m("arjun-patel", "Arjun Patel", 1962),
  m("timothy-cruz-1940", "Timothy Cruz", 1940, 2020),
  f("emma-young", "Emma Young", 1950),
  // Generation 4
  f("christina-cruz", "Christina Cruz", 1978),
  m("timothy-young-1970", "Timothy Young", 1970),
  m("cullen-cruz", "Cullen Cruz", 1975),
  f("marie-cruz", "Marie Cruz", 1973, 2018),
  f("sammie-chang", "Sammie Chang", 1985),
  m("steve-cruz", "Steve Cruz", 1985),
  f("arham-chopra", "Arham Chopra", 1983),
  f("maria-young", "Maria Young", 1988),
  m("marvin-young", "Marvin Young", 1970),
  f("jazmine-brooke", "Jazmine Brooke", 1975),
  // Generation 5
  f("carrie-young", "Carrie Young", 2001),
  m("carlo-young", "Carlo Young", 2003),
  m("tay-young", "Tay Young", 2005),
  f("jane-howell", "Jane Howell", 2002),
  m("william-cruz-2002", "William Cruz", 2002),
  f("anna-cruz", "Anna Cruz", 2012),
  f("taylor-cruz", "Taylor Cruz", 2009),
  f("amelia-young", "Amelia Young", 2001),
  m("jake-young", "Jake Young", 2002),
  m("timothy-young-2010", "Timothy Young", 2010),
  // Generation 6
  m("william-cruz-2021", "William Cruz", 2021),
  m("alex-cruz", "Alex Cruz", 2021),
];

const union = (
  id: string,
  partnerIds: Union["partnerIds"],
  childIds: string[],
  status: Union["status"] = "married",
  married: MarriageDate = {},
): Union => ({ id, partnerIds, status, ...married, childIds });

export const unions: Union[] = [
  union("u-timothy-amy", ["timothy-cruz-1880", "amy-harolds"], ["alexander-cruz"], "married", { marriageYear: 1910 }),
  union("u-cynthia-fred", ["cynthia-willow", "fred-lambert"], ["jerry-willow"]),
  union("u-margaret-nick", ["margaret-yap", "nick-young"], ["emma-young"]),
  union("u-alexander-jerry", ["alexander-cruz", "jerry-willow"], ["jake-cruz", "olivia-cruz", "timothy-cruz-1940"]),
  union("u-jake-taylor", ["jake-cruz", "taylor-humes"], ["christina-cruz", "cullen-cruz", "marie-cruz"], "married", { marriageYear: 1972, marriageMonth: 6, marriageDay: 14 }),
  union("u-olivia-arjun", ["olivia-cruz", "arjun-patel"], ["steve-cruz"], "married", { marriageYear: 1983 }),
  union("u-timothy-emma", ["timothy-cruz-1940", "emma-young"], ["maria-young", "marvin-young"]),
  union("u-christina-timothy", ["christina-cruz", "timothy-young-1970"], ["carrie-young", "carlo-young", "tay-young"]),
  union("u-sammie-steve", ["sammie-chang", "steve-cruz"], ["william-cruz-2002"], "divorced", { marriageYear: 2001 }),
  union("u-steve-arham", ["steve-cruz", "arham-chopra"], ["anna-cruz", "taylor-cruz"], "married", { marriageYear: 2008, marriageMonth: 9, marriageDay: 8 }),
  union("u-marvin-jazmine", ["marvin-young", "jazmine-brooke"], ["amelia-young", "jake-young", "timothy-young-2010"]),
  union("u-jane-william", ["jane-howell", "william-cruz-2002"], ["william-cruz-2021", "alex-cruz"]),
];

export const cruzYoung: FamilyData = { persons, unions };

/** The parents of people who married in. Not on the Cruz sheet unless added as extras. */
export const inLawParentIds = ["cynthia-willow", "fred-lambert", "margaret-yap", "nick-young"];

/** ARCHITECTURE.md §6 worked example: the Cruz sheet, rooted at Alexander Cruz. */
export const cruzSheet: Sheet = { rootPersonId: "alexander-cruz", extraPersonIds: [] };

/** The Cruz sheet with the in-law parents added, which reproduces the whole sample image. */
export const wholeSampleSheet: Sheet = { rootPersonId: "alexander-cruz", extraPersonIds: inLawParentIds };

/** An in-law sheet rooted at Jerry Willow. */
export const jerrySheet: Sheet = { rootPersonId: "jerry-willow", extraPersonIds: [] };
