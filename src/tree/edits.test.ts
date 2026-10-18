// @vitest-environment node
import { describe, expect, test } from "vitest";
import { OperationError } from "@/server/operations/plan";
import { applyPlan, sampleState, toGroupTree } from "@test/planning";
import {
  addChildOps,
  addParentsOps,
  addPartnerOps,
  coupleStatusOps,
  deletePersonOps,
  editPersonOps,
  moveSheetOps,
  relationsOf,
  restorePersonOps,
  tabOrder,
  updateSheetOps,
} from "./edits";
import { buildSheetView } from "./sheet-view";
import type { GroupTree } from "./types";

const start = sampleState();
const tree = toGroupTree(start);
const idOf = (t: GroupTree, name: string) => t.persons.find((p) => p.name === name)!.id;
const sheetCounts = (t: GroupTree) => Object.fromEntries(t.sheets.map((s) => [s.title, buildSheetView(t, s).persons.length]));
const apply = (ops: Parameters<typeof applyPlan>[1]) => toGroupTree(applyPlan(start, ops));

describe("edits against the sample family", () => {
  test("the sample's two sheets", () => {
    expect(sheetCounts(tree)).toEqual({ "Cruz family": 36, "Jerry Willow's family": 32 });
  });

  test("a child added under Jake and Taylor shows on every sheet that reaches them", () => {
    const jake = idOf(tree, "Jake Cruz");
    const couple = relationsOf(tree, jake).couples.find((c) => c.partner?.name === "Taylor Humes")!.union.id;
    const after = apply(addChildOps(tree, jake, couple, { name: "Baby Cruz", gender: "female", birthYear: 1990 }));
    expect(sheetCounts(after)).toEqual({ "Cruz family": 37, "Jerry Willow's family": 33 });
    expect(relationsOf(after, idOf(after, "Baby Cruz")).parents.map((p) => p.name)).toEqual(["Jake Cruz", "Taylor Humes"]);
  });

  test("a child with no partner gets a single-parent couple, reused for the next child", () => {
    const amelia = idOf(tree, "Amelia Young");
    const once = applyPlan(start, addChildOps(tree, amelia, null, { name: "Rhea Young", gender: "female" }));
    const t1 = toGroupTree(once);
    const alone = relationsOf(t1, amelia).couples.find((c) => !c.partner)!;
    expect(alone.children.map((c) => c.name)).toEqual(["Rhea Young"]);
    const t2 = toGroupTree(applyPlan(once, addChildOps(t1, amelia, null, { name: "Ravi Young", gender: "male" })));
    expect(relationsOf(t2, amelia).couples.find((c) => !c.partner)!.children.map((c) => c.name)).toEqual(["Rhea Young", "Ravi Young"]);
  });

  test("a partner who married in, with their own sheet rooted at them", () => {
    const amelia = idOf(tree, "Amelia Young");
    const after = apply(addPartnerOps(amelia, { name: "Rohan Mehta", gender: "male", birthYear: 1999 }, { status: "married", ownSheet: true }));
    const sheet = after.sheets.find((s) => s.title === "Rohan Mehta's family")!;
    expect(sheet.rootPersonId).toBe(idOf(after, "Rohan Mehta"));
    expect(buildSheetView(after, sheet).persons.map((p) => p.name).sort()).toEqual(["Amelia Young", "Rohan Mehta"]);
    expect(sheetCounts(after)["Cruz family"]).toBe(37); // partners show on the family's sheets
  });

  test("without their own sheet, no new tab", () => {
    const after = apply(addPartnerOps(idOf(tree, "Amelia Young"), { name: "Rohan Mehta", gender: "male" }, { status: "divorced", ownSheet: false }));
    expect(after.sheets).toHaveLength(2);
    expect(after.unions.find((u) => u.partnerIds.includes(idOf(after, "Rohan Mehta")))!.status).toBe("divorced");
  });

  test("add parents: both at once, or the other parent of someone who has one", () => {
    const rohanState = applyPlan(start, addPartnerOps(idOf(tree, "Amelia Young"), { name: "Rohan Mehta", gender: "male" }, { status: "married", ownSheet: true }));
    const rohanTree = toGroupTree(rohanState);
    const rohan = idOf(rohanTree, "Rohan Mehta");

    const one = applyPlan(rohanState, addParentsOps(rohanTree, rohan, [{ name: "Sunita Mehta", gender: "female" }]));
    const t1 = toGroupTree(one);
    expect(relationsOf(t1, rohan).parents.map((p) => p.name)).toEqual(["Sunita Mehta"]);

    const other = addParentsOps(t1, rohan, [{ name: "Vikram Mehta", gender: "male" }]);
    expect(other.map((o) => o.op)).toEqual(["createPerson", "addPartner"]);
    const t2 = toGroupTree(applyPlan(one, other));
    expect(relationsOf(t2, rohan).parents.map((p) => p.name)).toEqual(["Sunita Mehta", "Vikram Mehta"]);
    const rohansSheet = t2.sheets.find((s) => s.title === "Rohan Mehta's family")!;
    expect(buildSheetView(t2, rohansSheet).persons.map((p) => p.name)).toEqual(expect.arrayContaining(["Sunita Mehta", "Vikram Mehta"]));

    expect(() => addParentsOps(t2, rohan, [{ name: "X", gender: "male" }])).toThrow(/already have two parents/);
  });

  test("edit details: only what changed, and an empty year is cleared", () => {
    const taylor = tree.persons.find((p) => p.name === "Taylor Humes")!;
    expect(editPersonOps(taylor, { name: "Taylor Humes", gender: "female", birthYear: 1955 })).toEqual([]);
    const ops = editPersonOps(taylor, { name: "Taylor Cruz", gender: "female", deathYear: 2024 });
    expect(ops).toEqual([{ op: "updatePerson", personId: taylor.id, set: { name: "Taylor Cruz", birthYear: null, deathYear: 2024 } }]);
    const after = apply(ops).persons.find((p) => p.id === taylor.id)!;
    expect(after).toMatchObject({ name: "Taylor Cruz", deathYear: 2024 });
    expect(after.birthYear).toBeUndefined();
  });

  test("divorce, delete and Undo", () => {
    const steve = idOf(tree, "Steve Cruz");
    const steveAndArham = relationsOf(tree, steve).couples.find((c) => c.partner?.name === "Arham Chopra")!.union.id;
    expect(apply(coupleStatusOps(steveAndArham, "divorced")).unions.find((u) => u.id === steveAndArham)!.status).toBe("divorced");

    const alex = idOf(tree, "Alex Cruz");
    const deleted = applyPlan(start, deletePersonOps(alex));
    expect(sheetCounts(toGroupTree(deleted))["Cruz family"]).toBe(35);
    expect(sheetCounts(toGroupTree(applyPlan(deleted, restorePersonOps(alex))))["Cruz family"]).toBe(36);
  });

  test("add parents, delete them both, then add parents again; then replace one (found in the owner's check)", () => {
    const timothy = tree.persons.find((p) => p.name === "Timothy Cruz" && p.birthYear === 1880)!.id;
    const parents = [{ name: "John Cruz", gender: "male" as const }, { name: "Mary Cruz", gender: "female" as const }];
    let state = applyPlan(start, addParentsOps(tree, timothy, parents));
    const named = (name: string) => toGroupTree(state).persons.find((p) => p.name === name)!.id;
    state = applyPlan(state, [...deletePersonOps(named("John Cruz")), ...deletePersonOps(named("Mary Cruz"))]);

    let t = toGroupTree(state);
    expect(relationsOf(t, timothy).parents).toEqual([]); // what the panel shows: no parents
    state = applyPlan(state, addParentsOps(t, timothy, [{ name: "Joseph Cruz", gender: "male" }, { name: "Ruth Cruz", gender: "female" }]));
    t = toGroupTree(state);
    expect(relationsOf(t, timothy).parents.map((p) => p.name)).toEqual(["Joseph Cruz", "Ruth Cruz"]);
    expect(sheetCounts(t)["Cruz family"]).toBe(38);

    state = applyPlan(state, deletePersonOps(named("Joseph Cruz")));
    t = toGroupTree(state);
    expect(relationsOf(t, timothy).parents.map((p) => p.name)).toEqual(["Ruth Cruz"]); // "Add the other parent"
    state = applyPlan(state, addParentsOps(t, timothy, [{ name: "Peter Cruz", gender: "male" }]));
    expect(relationsOf(toGroupTree(state), timothy).parents.map((p) => p.name)).toEqual(["Ruth Cruz", "Peter Cruz"]);
  });

  test("a sheet's root can't be deleted", () => {
    expect(() => apply(deletePersonOps(idOf(tree, "Jerry Willow")))).toThrow(OperationError);
    expect(() => apply(deletePersonOps(idOf(tree, "Jerry Willow")))).toThrow(/Jerry Willow is the root of the sheet Jerry Willow's family/);
  });
});

describe("tabs", () => {
  const withThird = toGroupTree(
    applyPlan(start, [{ op: "createSheet", tempId: "new:s", title: "Emma Young's family", rootPersonId: idOf(tree, "Emma Young") }]),
  );
  const titles = (t: GroupTree) => tabOrder(t.sheets).map((s) => s.title);

  test("pinned tabs first, then the saved order", () => {
    expect(titles(withThird)).toEqual(["Cruz family", "Jerry Willow's family", "Emma Young's family"]);
    const cruz = withThird.sheets.find((s) => s.title === "Cruz family")!.id;
    const unpinned = toGroupTree(
      applyPlan(start, [
        { op: "createSheet", tempId: "new:s", title: "Emma Young's family", rootPersonId: idOf(tree, "Emma Young") },
        ...updateSheetOps(cruz, { pinned: false }),
      ]),
    );
    expect(titles(unpinned)).toEqual(["Jerry Willow's family", "Cruz family", "Emma Young's family"]);
  });

  test("a tab moves among tabs like it, and the whole order is saved", () => {
    const [cruz, jerry, emma] = tabOrder(withThird.sheets);
    expect(moveSheetOps(withThird.sheets, jerry.id, -1)).toEqual([{ op: "reorderSheets", sheetIds: [jerry.id, cruz.id, emma.id] }]);
    expect(moveSheetOps(withThird.sheets, cruz.id, -1)).toBeNull(); // already first
    expect(moveSheetOps(withThird.sheets, emma.id, -1)).toBeNull(); // pinned tabs stay first
    expect(moveSheetOps(withThird.sheets, jerry.id, 1)).toBeNull();
  });
});
