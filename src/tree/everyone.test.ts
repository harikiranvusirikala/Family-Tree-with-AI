// @vitest-environment node
import { describe, expect, test } from "vitest";
import { sampleState, toGroupTree } from "@test/planning";
import { chooseView, EVERYONE, everyoneHref, everyoneView, filterRows, findPeople, firstMarriage, listRows, marriageLines, relationSummary, sortRows } from "./everyone";
import type { GroupTree } from "./types";

const tree = toGroupTree(sampleState());
const idOf = (t: GroupTree, name: string) => t.persons.find((p) => p.name === name)!.id;

describe("★ Everyone (owner request)", () => {
  test("its address can't be a sheet's id", () => {
    expect(EVERYONE).not.toMatch(/^[0-9a-f]{24}$/);
  });

  test("every person and every couple of the sample, around the first sheet's root", () => {
    const view = everyoneView(tree);
    expect(view.persons).toHaveLength(36);
    expect(view.unions).toHaveLength(12);
    expect(view.rootPersonId).toBe(idOf(tree, "Alexander Cruz")); // Cruz family, the first pinned sheet
  });

  test("people on no sheet and a family not joined to the rest are included", () => {
    const ravi = { id: "a".repeat(24), name: "Ravi Rao", gender: "male" as const };
    const priya = { id: "b".repeat(24), name: "Priya Rao", gender: "female" as const };
    const loner = { id: "c".repeat(24), name: "Zoë Ávila", gender: "female" as const };
    const more: GroupTree = {
      ...tree,
      persons: [...tree.persons, ravi, priya, loner],
      unions: [...tree.unions, { id: "d".repeat(24), partnerIds: [ravi.id, priya.id], status: "married", childIds: [] }],
    };
    const view = everyoneView(more);
    expect(view.persons).toHaveLength(39);
    expect(view.unions).toHaveLength(13);
  });

  test("a couple whose partner was removed isn't drawn as a couple, and removed children aren't drawn", () => {
    const steve = idOf(tree, "Steve Cruz");
    const sammie = idOf(tree, "Sammie Chang");
    const william = idOf(tree, "William Cruz");
    const without: GroupTree = { ...tree, persons: tree.persons.filter((p) => p.id !== sammie && p.name !== "Anna Cruz") };
    const view = everyoneView(without);
    expect(view.unions.find((u) => u.partnerIds.includes(steve) && u.childIds.includes(william))).toBeUndefined();
    const withArham = view.unions.find((u) => u.partnerIds.includes(steve) && u.partnerIds.includes(idOf(tree, "Arham Chopra")))!;
    expect(withArham.childIds).toEqual([idOf(tree, "Taylor Cruz")]);
  });

  test("a group with no sheets yet centres on its first person", () => {
    expect(everyoneView({ ...tree, sheets: [] }).rootPersonId).toBe(tree.persons[0].id);
  });
});

describe("Find someone (owner request)", () => {
  const names = (query: string) => findPeople(tree.persons, query).map((p) => `${p.name} ${p.birthYear}`);

  test("any part of a name, names starting with it first, then A to Z and oldest first", () => {
    expect(names("young").slice(0, 3)).toEqual(["Amelia Young 2001", "Carlo Young 2003", "Carrie Young 2001"]);
    expect(names("tim")).toEqual(["Timothy Cruz 1880", "Timothy Cruz 1940", "Timothy Young 1970", "Timothy Young 2010"]);
    expect(names("ame")[0]).toBe("Amelia Young 2001");
  });

  test("ignores case, accents and extra spaces; nothing for an empty search; at most eight", () => {
    const zoe = { id: "z".repeat(24), name: "Zoë Ávila", gender: "female" as const };
    expect(findPeople([...tree.persons, zoe], "  ZOE  avila ").map((p) => p.name)).toEqual(["Zoë Ávila"]);
    expect(findPeople(tree.persons, "   ")).toEqual([]);
    expect(findPeople(tree.persons, "cruz")).toHaveLength(8);
  });
});

describe("the List (★ Everyone, part 2, owner request)", () => {
  const rows = listRows(tree);
  const row = (name: string, rs = rows) => rs.find((r) => r.person.name === name)!;
  const names = (people: { name: string }[]) => people.map((p) => p.name);

  test("everyone, A to Z by the name as written, the same name oldest first", () => {
    expect(rows).toHaveLength(36);
    expect(rows.slice(0, 4).map((r) => r.person.name)).toEqual(["Alex Cruz", "Alexander Cruz", "Amelia Young", "Amy Harolds"]);
    expect(rows.filter((r) => r.person.name === "Timothy Cruz").map((r) => r.person.birthYear)).toEqual([1880, 1940]);
  });

  test("each person's parents, partners (divorced marked), children and the sheets that show them, in tab order", () => {
    const steve = row("Steve Cruz");
    expect(names(steve.parents)).toEqual(["Olivia Cruz", "Arjun Patel"]);
    expect(steve.partners.map((p) => [p.person.name, p.divorced])).toEqual([["Sammie Chang", true], ["Arham Chopra", false]]);
    expect(names(steve.children)).toEqual(["William Cruz", "Anna Cruz", "Taylor Cruz"]);
    expect(steve.sheets.map((s) => s.title)).toEqual(["Cruz family", "Jerry Willow's family"]);
    expect(row("Amy Harolds").sheets.map((s) => s.title)).toEqual(["Cruz family"]); // not on Jerry Willow's family
    expect(row("Amy Harolds").parents).toEqual([]);
  });

  test("married in: a partner, no parents added, and a partner whose parents are", () => {
    expect(filterRows(rows, "marriedIn").map((r) => r.person.name)).toEqual([
      "Arham Chopra", "Arjun Patel", "Jane Howell", "Jazmine Brooke", "Sammie Chang", "Taylor Humes", "Timothy Young",
    ]);
    expect(row("Jerry Willow").marriedIn).toBe(false); // his parents are added
    expect(row("Timothy Cruz").marriedIn).toBe(false); // the top of the tree
  });

  test("filters: everyone, living, married in, on no sheet; narrowed by a name typed", () => {
    expect([filterRows(rows, "everyone"), filterRows(rows, "living"), filterRows(rows, "noSheet")].map((r) => r.length)).toEqual([36, 25, 0]);
    const zoe = { id: "z".repeat(24), name: "Zoë Ávila", gender: "female" as const };
    const more = listRows({ ...tree, persons: [...tree.persons, zoe] });
    expect(filterRows(more, "noSheet").map((r) => r.person.name)).toEqual(["Zoë Ávila"]);
    expect(row("Zoë Ávila", more)).toMatchObject({ parents: [], partners: [], children: [], sheets: [], marriedIn: false });
    expect(filterRows(rows, "everyone", "  YOUNG ").map((r) => r.person.name).slice(0, 2)).toEqual(["Amelia Young", "Carlo Young"]);
    expect(filterRows(rows, "living", "timothy").map((r) => `${r.person.name} ${r.person.birthYear}`)).toEqual(["Timothy Young 1970", "Timothy Young 2010"]);
  });

  test("the line under a name when the List is narrow", () => {
    expect(relationSummary(row("Steve Cruz"))).toEqual(["Child of Olivia & Arjun", "♥ Sammie (2001), Arham (2008)", "3 children"]);
    expect(relationSummary(row("Arjun Patel"))).toEqual(["♥ Olivia (1983)", "1 child"]);
    expect(relationSummary(row("Marvin Young"))).toEqual(["Child of Timothy & Emma", "♥ Jazmine", "3 children"]); // no marriage date
    expect(relationSummary(row("Alex Cruz"))).toEqual(["Child of Jane & William"]);
    const alone = listRows({ ...tree, persons: [{ id: "z".repeat(24), name: "Zoë Ávila", gender: "female" }], unions: [] })[0];
    expect(relationSummary(alone)).toEqual([]);
  });

  test("marriage dates (an owner request): one line per dated marriage, the partner named when there are several", () => {
    expect(row("Steve Cruz").partners.map((p) => p.married)).toEqual([{ marriageYear: 2001 }, { marriageYear: 2008, marriageMonth: 9, marriageDay: 8 }]);
    expect(marriageLines(row("Steve Cruz"))).toEqual(["2001 · Sammie", "8 Sep 2008 · Arham"]);
    expect(marriageLines(row("Taylor Humes"))).toEqual(["14 Jun 1972"]);
    expect(marriageLines(row("Marvin Young"))).toEqual([]);
    expect(marriageLines(row("Alex Cruz"))).toEqual([]);
    expect(firstMarriage(row("Steve Cruz"))).toBe(firstMarriage(row("Sammie Chang"))); // the earlier of his two
  });

  test("sorting by marriage: by the first marriage, a year alone before that year's dates, nobody without one until the end", () => {
    const order = (rs: typeof rows, sort: "marriedEarliest" | "marriedLatest") => sortRows(rs, sort).map((r) => r.person.name);
    const dated = ["Amy Harolds", "Timothy Cruz", "Jake Cruz", "Taylor Humes", "Arjun Patel", "Olivia Cruz", "Sammie Chang", "Steve Cruz", "Arham Chopra"];
    expect(order(rows, "marriedEarliest").slice(0, 9)).toEqual(dated);
    expect(order(rows, "marriedLatest").slice(0, 9)).toEqual(["Arham Chopra", "Sammie Chang", "Steve Cruz", "Arjun Patel", "Olivia Cruz", "Jake Cruz", "Taylor Humes", "Amy Harolds", "Timothy Cruz"]);
    // Everyone else keeps A to Z after them, either way (Timothy Cruz, 1940, has no marriage date).
    const rest = rows.filter((r) => firstMarriage(r) === undefined).map((r) => r.person.name);
    expect(rest).toHaveLength(36 - 9);
    expect(order(rows, "marriedEarliest").slice(9)).toEqual(rest);
    expect(order(rows, "marriedLatest").slice(9)).toEqual(rest);
    // Olivia and Arjun married in 1972 too, with no day known: before Jake and Taylor's 14 June.
    const sameYear = listRows({ ...tree, unions: tree.unions.map((u) => (u.partnerIds.includes(idOf(tree, "Arjun Patel")) ? { ...u, marriageYear: 1972 } : u)) });
    expect(order(sameYear, "marriedEarliest").slice(2, 6)).toEqual(["Arjun Patel", "Olivia Cruz", "Jake Cruz", "Taylor Humes"]);
  });

  test("2,000 people make their rows quickly", () => {
    const persons = Array.from({ length: 2000 }, (_, i) => ({ id: i.toString(16).padStart(24, "0"), name: `Person ${i}`, gender: "male" as const }));
    const unions = Array.from({ length: 999 }, (_, i) => ({ id: `u${i}`.padStart(24, "0"), partnerIds: [persons[i].id] as [string], status: "married" as const, childIds: [persons[i + 1000].id] }));
    const start = performance.now();
    listRows({ persons, unions, sheets: tree.sheets });
    expect(performance.now() - start).toBeLessThan(process.env.CI ? 1000 : 300);
  });
});

describe("which ★ Everyone view opens (owner request)", () => {
  test("the address's, else the last used on this device, else List on a phone and Tree elsewhere", () => {
    expect(chooseView("list", "tree", false)).toBe("list");
    expect(chooseView(null, "list", false)).toBe("list");
    expect(chooseView("wheel", "tree", true)).toBe("wheel");
    expect(chooseView("circles", "tree", true)).toBe("tree"); // not a view
    expect(chooseView(null, null, true)).toBe("list");
    expect(chooseView(null, "nonsense", false)).toBe("tree");
    expect(chooseView("upcoming", "tree", false)).toBe("upcoming"); // birthdays and anniversaries (owner request)
    expect(chooseView(null, "upcoming", true)).toBe("upcoming");
  });

  test("its address holds the view and the selected person", () => {
    expect(everyoneHref("g1", "list", "p1")).toBe("/g/g1/s/everyone?view=list&person=p1");
    expect(everyoneHref("g1", "tree")).toBe("/g/g1/s/everyone?view=tree");
    expect(everyoneHref("g1", "upcoming", "p1")).toBe("/g/g1/s/everyone?view=upcoming&person=p1");
    expect(everyoneHref("g1", "wheel", "p1", "c1")).toBe("/g/g1/s/everyone?view=wheel&centre=c1&person=p1");
    expect(everyoneHref("g1", "list", "p1", "c1")).toBe("/g/g1/s/everyone?view=list&person=p1"); // the middle is the Wheel's
  });
});
