// @vitest-environment node
import { ObjectId } from "mongodb";
import { describe, expect, test } from "vitest";
import { OperationError } from "@/server/operations/plan";
import { applyPlan, sampleState, toGroupTree } from "@test/planning";
import {
  addChildOps,
  addParentsOps,
  addPartnerOps,
  coupleStatusOps,
  deletePersonOps,
  deleteSheetOps,
  editPersonOps,
  moveSheetOps,
  newSheetOps,
  relationsOf,
  restorePersonOps,
  setPhotoOps,
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

  test("add parents: the mother can get her own sheet, with her side of the family only: not the father's, and not her children (owner request)", () => {
    const rohanState = applyPlan(start, addPartnerOps(idOf(tree, "Amelia Young"), { name: "Rohan Mehta", gender: "male" }, { status: "married", ownSheet: true }));
    const rohanTree = toGroupTree(rohanState);
    const rohan = idOf(rohanTree, "Rohan Mehta");

    const ops = addParentsOps(rohanTree, rohan, [
      { name: "Vikram Mehta", gender: "male" },
      { name: "Sunita Mehta", gender: "female", ownSheet: true },
    ]);
    expect(ops.filter((o) => o.op === "createSheet")).toEqual([
      { op: "createSheet", tempId: "new:sheet-2", title: "Sunita Mehta's family", rootPersonId: "new:parent-2", hideChildrenOf: "new:parents" },
    ]);
    let state = applyPlan(rohanState, ops);
    let t = toGroupTree(state);
    const sunita = t.sheets.find((s) => s.title === "Sunita Mehta's family")!;
    expect(sunita.rootPersonId).toBe(idOf(t, "Sunita Mehta"));
    expect(sunita.hideChildrenOf).toBe(relationsOf(t, rohan).parentsCouple!.id);
    expect(t.sheets).toHaveLength(4); // the sample's two, Rohan's, and Sunita's; none for the father
    expect(buildSheetView(t, sunita).persons.map((p) => p.name).sort()).toEqual(["Sunita Mehta", "Vikram Mehta"]);

    // Both sides get parents, and Sunita a brother: her sheet shows her side; Rohan's, his father's side
    // and Sunita, but not her parents or brother (an owner request: they're on her sheet).
    state = applyPlan(state, addParentsOps(t, idOf(t, "Sunita Mehta"), [{ name: "Mohan Rao", gender: "male" }, { name: "Lata Rao", gender: "female" }]));
    t = toGroupTree(state);
    state = applyPlan(state, addChildOps(t, idOf(t, "Mohan Rao"), relationsOf(t, idOf(t, "Sunita Mehta")).parentsCouple!.id, { name: "Anil Rao", gender: "male" }));
    t = toGroupTree(state);
    state = applyPlan(state, addParentsOps(t, idOf(t, "Vikram Mehta"), [{ name: "Raj Mehta", gender: "male" }, { name: "Kamala Mehta", gender: "female" }]));
    t = toGroupTree(state);
    expect(buildSheetView(t, sunita).persons.map((p) => p.name).sort()).toEqual(["Anil Rao", "Lata Rao", "Mohan Rao", "Sunita Mehta", "Vikram Mehta"]);
    const rohanSheet = t.sheets.find((s) => s.title === "Rohan Mehta's family")!;
    expect(buildSheetView(t, rohanSheet).persons.map((p) => p.name).sort()).toEqual(
      ["Amelia Young", "Kamala Mehta", "Raj Mehta", "Rohan Mehta", "Sunita Mehta", "Vikram Mehta"],
    );
    expect(t.sheets).toHaveLength(4);
  });

  test("add the other parent: a mother can get her own sheet too, without the couple's children", () => {
    const rohanState = applyPlan(start, addPartnerOps(idOf(tree, "Amelia Young"), { name: "Rohan Mehta", gender: "male" }, { status: "married", ownSheet: false }));
    const rohan = idOf(toGroupTree(rohanState), "Rohan Mehta");
    const one = applyPlan(rohanState, addParentsOps(toGroupTree(rohanState), rohan, [{ name: "Vikram Mehta", gender: "male" }]));
    const couple = relationsOf(toGroupTree(one), rohan).parentsCouple!.id;
    const other = addParentsOps(toGroupTree(one), rohan, [{ name: "Sunita Mehta", gender: "female", ownSheet: true }]);
    expect(other.map((o) => o.op)).toEqual(["createPerson", "addPartner", "createSheet"]);
    expect(other[2]).toMatchObject({ hideChildrenOf: couple });
    const t = toGroupTree(applyPlan(one, other));
    const sunita = t.sheets.find((s) => s.title === "Sunita Mehta's family")!;
    expect(sunita.rootPersonId).toBe(idOf(t, "Sunita Mehta"));
    expect(buildSheetView(t, sunita).persons.map((p) => p.name).sort()).toEqual(["Sunita Mehta", "Vikram Mehta"]);
  });

  test("a sheet of her own, later: leaving out her children with her partner, or showing them all (owner request)", () => {
    const taylor = idOf(tree, "Taylor Humes");
    const withJake = relationsOf(tree, taylor).couples.find((c) => c.partner?.name === "Jake Cruz")!.union.id;
    expect(newSheetOps(taylor, "Taylor Humes's family", withJake)).toEqual([
      { op: "createSheet", tempId: "new:sheet", title: "Taylor Humes's family", rootPersonId: taylor, hideChildrenOf: withJake },
    ]);

    const hidden = apply(newSheetOps(taylor, "Taylor Humes's family", withJake));
    const hers = hidden.sheets.find((s) => s.title === "Taylor Humes's family")!;
    expect(hers).toMatchObject({ rootPersonId: taylor, hideChildrenOf: withJake, pinned: false });
    expect(buildSheetView(hidden, hers).persons.map((p) => p.name).sort()).toEqual(["Jake Cruz", "Taylor Humes"]);

    const all = apply(newSheetOps(taylor, "Taylor Humes's family"));
    const sheet = all.sheets.find((s) => s.title === "Taylor Humes's family")!;
    expect(sheet.hideChildrenOf).toBeUndefined();
    expect(buildSheetView(all, sheet).persons.map((p) => p.name)).toEqual(expect.arrayContaining(["Jake Cruz", "Christina Cruz", "Cullen Cruz", "Marie Cruz", "Carrie Young"]));
  });

  test("a new name renames the person's sheet when it has its given title, and keeps a title of your own (owner request)", () => {
    const jerry = tree.persons.find((p) => p.name === "Jerry Willow")!;
    const ops = editPersonOps(jerry, { name: "Jerry Willow-Cruz", gender: jerry.gender, birthYear: jerry.birthYear }, tree.sheets);
    expect(ops.map((o) => o.op)).toEqual(["updatePerson", "updateSheet"]);
    const renamed = apply(ops);
    expect(renamed.sheets.map((s) => s.title)).toEqual(["Cruz family", "Jerry Willow-Cruz's family"]);

    const own = apply(updateSheetOps(tree.sheets[1].id, { title: "The Willows" }));
    expect(editPersonOps(jerry, { name: "Jerry Willow-Cruz", gender: jerry.gender, birthYear: jerry.birthYear }, own.sheets).map((o) => o.op)).toEqual(["updatePerson"]);
    expect(editPersonOps(jerry, { name: jerry.name, gender: jerry.gender, birthYear: 1950 }, tree.sheets).map((o) => o.op)).toEqual(["updatePerson"]);
  });

  test("delete a sheet: it's gone from the tabs, its people stay, and then its root can be deleted (owner request)", () => {
    const jerrySheet = tree.sheets.find((s) => s.title === "Jerry Willow's family")!;
    const unpinned = applyPlan(start, updateSheetOps(jerrySheet.id, { pinned: false }));
    const gone = applyPlan(unpinned, deleteSheetOps(jerrySheet.id));
    const t = toGroupTree(gone);
    expect(t.sheets.map((s) => s.title)).toEqual(["Cruz family"]);
    expect(t.persons).toHaveLength(tree.persons.length);
    expect(toGroupTree(applyPlan(gone, deletePersonOps(idOf(t, "Jerry Willow")))).persons).toHaveLength(tree.persons.length - 1);
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

  test("a photo shows wherever the person does, and can be removed", () => {
    const groupId = new ObjectId();
    const jake = idOf(tree, "Jake Cruz");
    const photoId = `groups/${groupId.toHexString()}/jake-photo-1`;
    const withPhoto = applyPlan(start, setPhotoOps(jake, photoId), groupId);
    const t = toGroupTree(withPhoto);
    for (const sheet of t.sheets) {
      expect(buildSheetView(t, sheet).persons.find((p) => p.id === jake)?.photoId).toBe(photoId);
    }
    expect(toGroupTree(applyPlan(withPhoto, setPhotoOps(jake, null), groupId)).persons.find((p) => p.id === jake)).not.toHaveProperty("photoId");
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
