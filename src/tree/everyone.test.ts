// @vitest-environment node
import { describe, expect, test } from "vitest";
import { sampleState, toGroupTree } from "@test/planning";
import { EVERYONE, everyoneView, findPeople } from "./everyone";
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
