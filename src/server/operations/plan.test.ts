// @vitest-environment node
import { ObjectId } from "mongodb";
import { describe, expect, test } from "vitest";
import { buildSheetView } from "@/tree/sheet-view";
import type { FamilyData, Union } from "@/tree/types";
import { cruzYoung, inLawParentIds } from "@test/fixtures/cruz-young";
import { operationsFromFamily } from "./from-family";
import { OperationError, planOperations, type GroupState, type Plan } from "./plan";
import { operationsSchema, type Operation } from "./schema";

const groupId = new ObjectId();
const now = new Date("2026-10-18T00:00:00Z");
const empty: GroupState = { persons: [], unions: [], sheets: [] };
const plan = (state: GroupState, ops: Operation[]) => planOperations(groupId, state, ops, "tester", now);

/** The group's state once a plan has been written. */
function after(state: GroupState, p: Plan): GroupState {
  const merge = <T extends { _id: ObjectId }>(docs: T[], changes: { inserted: T[]; updated: T[] }) => {
    const byId = new Map(changes.updated.map((d) => [d._id.toHexString(), d]));
    return [...docs.map((d) => byId.get(d._id.toHexString()) ?? d), ...changes.inserted];
  };
  return { persons: merge(state.persons, p.persons), unions: merge(state.unions, p.unions), sheets: merge(state.sheets, p.sheets) };
}

function toFamily(state: GroupState): FamilyData {
  return {
    persons: state.persons.filter((p) => !p.deletedAt).map((p) => ({ id: p._id.toHexString(), name: p.name, gender: p.gender })),
    unions: state.unions.map((u) => ({
      id: u._id.toHexString(),
      partnerIds: u.partnerIds.map((x) => x.toHexString()) as Union["partnerIds"],
      status: u.status,
      childIds: u.childIds.map((x) => x.toHexString()),
    })),
  };
}

const sampleOps = operationsFromFamily(cruzYoung, [
  { title: "Cruz family", rootPersonId: "alexander-cruz", extraPersonIds: inLawParentIds, pinned: true },
]);
const sample = after(empty, plan(empty, sampleOps));
const idOf = (name: string, birthYear?: number) =>
  sample.persons.find((p) => p.name === name && (birthYear === undefined || p.birthYear === birthYear))!._id.toHexString();

function expectRejected(state: GroupState, ops: Operation[], message: RegExp, index = ops.length - 1) {
  try {
    plan(state, ops);
  } catch (error) {
    expect(error).toBeInstanceOf(OperationError);
    expect((error as OperationError).index).toBe(index);
    expect((error as Error).message).toMatch(message);
    return;
  }
  throw new Error("expected the batch to be rejected");
}

describe("planOperations: building a family", () => {
  test("one batch recreates the whole sample family", () => {
    const p = plan(empty, sampleOps);
    expect(p.persons.inserted).toHaveLength(36);
    expect(p.unions.inserted).toHaveLength(12);
    expect(p.sheets.inserted).toHaveLength(1);
    expect(p.sheets.inserted[0]).toMatchObject({ title: "Cruz family", pinned: true, order: 0 });
    expect(p.sheets.inserted[0].extraPersonIds).toHaveLength(4);
    expect(p.persons.inserted[0]).toMatchObject({ groupId, createdBy: "tester", createdAt: now, updatedBy: "tester" });
    expect(p.idMap["new:alexander-cruz"]).toBe(p.persons.inserted.find((x) => x.name === "Alexander Cruz")!._id.toHexString());
  });

  test("the saved data gives the same sheets as the sample", () => {
    const sheet = sample.sheets[0];
    const view = buildSheetView(toFamily(sample), {
      rootPersonId: sheet.rootPersonId.toHexString(),
      extraPersonIds: sheet.extraPersonIds.map((x) => x.toHexString()),
    });
    expect(view.persons).toHaveLength(36);
    expect(buildSheetView(toFamily(sample), { rootPersonId: sheet.rootPersonId.toHexString(), extraPersonIds: [] }).persons).toHaveLength(32);
  });

  test("does not modify the state it is given", () => {
    const before = JSON.stringify(sample);
    plan(sample, [
      { op: "updatePerson", personId: idOf("Steve Cruz"), set: { name: "Steven Cruz" } },
      { op: "addChild", unionId: sample.unions[0]._id.toHexString(), childId: idOf("Nick Young") },
    ]);
    expect(JSON.stringify(sample)).toBe(before);
  });

  test("operations can refer to things created earlier in the batch", () => {
    const p = plan(sample, [
      { op: "createPerson", tempId: "new:1", name: "Priya Sharma", gender: "female", birthYear: 1990 },
      { op: "createUnion", tempId: "new:2", partnerIds: [idOf("Cullen Cruz"), "new:1"], status: "married" },
      { op: "createPerson", tempId: "new:3", name: "Baby Cruz", gender: "male", birthYear: 2026 },
      { op: "addChild", unionId: "new:2", childId: "new:3" },
      { op: "createSheet", tempId: "new:4", title: "Priya Sharma's family", rootPersonId: "new:1" },
    ]);
    expect(p.unions.inserted[0].childIds.map((x) => x.toHexString())).toEqual([p.idMap["new:3"]]);
    expect(p.sheets.inserted[0]).toMatchObject({ order: 1, pinned: false });
  });

  test("updatePerson with null clears a year", () => {
    const p = plan(sample, [{ op: "updatePerson", personId: idOf("Jake Cruz"), set: { deathYear: null } }]);
    expect(p.persons.updated[0].deathYear).toBeUndefined();
    expect(p.persons.updated[0].updatedBy).toBe("tester");
  });

  test("repeating addChild or addToSheet changes nothing", () => {
    const steve = sample.unions.find((u) => u.childIds.some((c) => c.toHexString() === idOf("Steve Cruz")))!;
    const p = plan(sample, [
      { op: "addChild", unionId: steve._id.toHexString(), childId: idOf("Steve Cruz") },
      { op: "addToSheet", sheetId: sample.sheets[0]._id.toHexString(), personId: idOf("Nick Young") },
    ]);
    expect(p.unions.updated).toHaveLength(0);
    expect(p.sheets.updated).toHaveLength(0);
  });
});

describe("planOperations: soft delete and undo", () => {
  test("a deleted person can be restored", () => {
    const deleted = after(sample, plan(sample, [{ op: "deletePerson", personId: idOf("Marie Cruz") }]));
    expect(deleted.persons.find((p) => p.name === "Marie Cruz")!.deletedAt).toEqual(now);
    const restored = after(deleted, plan(deleted, [{ op: "restorePerson", personId: idOf("Marie Cruz") }]));
    expect(restored.persons.find((p) => p.name === "Marie Cruz")!.deletedAt).toBeUndefined();
  });

  test("a deleted person can't be used, and only deleted people can be restored", () => {
    const deleted = after(sample, plan(sample, [{ op: "deletePerson", personId: idOf("Marie Cruz") }]));
    expectRejected(deleted, [{ op: "createUnion", partnerIds: [idOf("Marie Cruz")], status: "married" }], /not found/);
    expectRejected(sample, [{ op: "restorePerson", personId: idOf("Marie Cruz") }], /is not deleted/);
  });
});

describe("planOperations: rejected batches", () => {
  test("unknown people, couples and sheets", () => {
    const missing = new ObjectId().toHexString();
    expectRejected(sample, [{ op: "updatePerson", personId: missing, set: { name: "X" } }], /person .* not found/);
    expectRejected(sample, [{ op: "updateUnion", unionId: missing, set: { status: "divorced" } }], /couple .* not found/);
    expectRejected(sample, [{ op: "addToSheet", sheetId: missing, personId: idOf("Steve Cruz") }], /sheet .* not found/);
  });

  test("records from another group are not found", () => {
    const otherGroup = planOperations(new ObjectId(), empty, sampleOps, "tester", now);
    const foreignPerson = otherGroup.persons.inserted[0]._id.toHexString();
    expectRejected(sample, [{ op: "setPhoto", personId: foreignPerson, photoId: "x" }], /not found/);
  });

  test("temporary ids must be created first, used once, and used for the right kind", () => {
    expectRejected(empty, [{ op: "createUnion", partnerIds: ["new:9"], status: "married" }], /not created earlier/);
    const person: Operation = { op: "createPerson", tempId: "new:1", name: "A", gender: "male" };
    expectRejected(empty, [person, { ...person }], /used twice/);
    expectRejected(empty, [person, { op: "addChild", unionId: "new:1", childId: "new:1" }], /is a person, not a union/);
  });

  test("couples: two different people, and no duplicates", () => {
    expectRejected(sample, [{ op: "createUnion", partnerIds: [idOf("Steve Cruz"), idOf("Steve Cruz")], status: "married" }], /two different people/);
    expectRejected(sample, [{ op: "createUnion", partnerIds: [idOf("Arham Chopra"), idOf("Steve Cruz")], status: "married" }], /already a couple/);
  });

  test("a person has one set of parents and can't be their own ancestor", () => {
    const jakeAndTaylor = sample.unions.find((u) => u.childIds.some((c) => c.toHexString() === idOf("Marie Cruz")))!._id.toHexString();
    expectRejected(sample, [{ op: "addChild", unionId: jakeAndTaylor, childId: idOf("Steve Cruz") }], /already has parents/);
    expectRejected(
      sample,
      [
        { op: "createUnion", tempId: "new:u", partnerIds: [idOf("William Cruz", 2021)], status: "married" },
        { op: "addChild", unionId: "new:u", childId: idOf("Timothy Cruz", 1880) },
      ],
      /ancestor/,
    );
  });

  test("full dates (owner request): saved and cleared; a day and month only together, with their year, and real", () => {
    const born = plan(empty, [{ op: "createPerson", tempId: "new:1", name: "A", gender: "female", birthYear: 1985, birthMonth: 3, birthDay: 12, deathYear: 2020, deathMonth: 6, deathDay: 3 }]);
    expect(born.persons.inserted[0]).toMatchObject({ birthYear: 1985, birthMonth: 3, birthDay: 12, deathYear: 2020, deathMonth: 6, deathDay: 3 });
    const set = plan(sample, [{ op: "updatePerson", personId: idOf("Steve Cruz"), set: { birthMonth: 2, birthDay: 28 } }]);
    expect(set.persons.updated[0]).toMatchObject({ birthYear: 1985, birthMonth: 2, birthDay: 28 });
    const cleared = plan(after(sample, set), [{ op: "updatePerson", personId: idOf("Steve Cruz"), set: { birthMonth: null, birthDay: null } }]);
    expect(cleared.persons.updated[0].birthMonth).toBeUndefined();
    expect(cleared.persons.updated[0].birthYear).toBe(1985);
    expectRejected(sample, [{ op: "updatePerson", personId: idOf("Steve Cruz"), set: { birthMonth: 2, birthDay: 29 } }], /29 Feb 1985 isn't a real date/);
    expectRejected(sample, [{ op: "updatePerson", personId: idOf("Steve Cruz"), set: { birthMonth: 2 } }], /both the day and the month/);
    expectRejected(empty, [{ op: "createPerson", tempId: "new:1", name: "A", gender: "male", birthMonth: 2, birthDay: 3 }], /need the birth year/);
    expectRejected(after(sample, set), [{ op: "updatePerson", personId: idOf("Steve Cruz"), set: { birthYear: null } }], /need the birth year/); // the date goes with it
  });

  test("marriage dates (owner request): saved with a new couple, changed and cleared; the rules of a birth date; never a single parent's", () => {
    const created = plan(sample, [
      { op: "createUnion", tempId: "new:c", partnerIds: [idOf("Cullen Cruz"), idOf("Maria Young")], status: "married", marriageYear: 2010, marriageMonth: 3, marriageDay: 12 },
    ]);
    expect(created.unions.inserted[0]).toMatchObject({ marriageYear: 2010, marriageMonth: 3, marriageDay: 12 });
    const couple = created.unions.inserted[0]._id.toHexString();
    const state = after(sample, created);
    expect(plan(state, [{ op: "updateUnion", unionId: couple, set: { marriageYear: 2011 } }]).unions.updated[0]).toMatchObject({ marriageYear: 2011, marriageMonth: 3, marriageDay: 12 });
    const cleared = plan(state, [{ op: "updateUnion", unionId: couple, set: { marriageYear: null, marriageMonth: null, marriageDay: null } }]).unions.updated[0];
    expect([cleared.marriageYear, cleared.marriageMonth, cleared.marriageDay]).toEqual([undefined, undefined, undefined]);
    expect(plan(state, [{ op: "updateUnion", unionId: couple, set: { status: "divorced" } }]).unions.updated[0]).toMatchObject({ status: "divorced", marriageYear: 2010 }); // the date stays
    expectRejected(state, [{ op: "updateUnion", unionId: couple, set: { marriageMonth: 2, marriageDay: 30 } }], /Cullen Cruz and Maria Young: 30 Feb 2010 isn't a real date/);
    expectRejected(state, [{ op: "updateUnion", unionId: couple, set: { marriageDay: null } }], /both the day and the month of the marriage/);
    expectRejected(state, [{ op: "updateUnion", unionId: couple, set: { marriageYear: null } }], /need the marriage year/); // the day and month go with it
    expectRejected(sample, [{ op: "createUnion", partnerIds: [idOf("Cullen Cruz")], status: "married", marriageYear: 2000 }], /a single parent has no marriage date/);
  });

  test("a couple whose partner was deleted keeps its date for Undo; its status can change, but it can't be given a date", () => {
    const arham = idOf("Arham Chopra");
    const couple = sample.unions.find((u) => u.partnerIds.some((p) => p.toHexString() === arham))!._id.toHexString();
    const deleted = after(sample, plan(sample, [{ op: "deletePerson", personId: arham }]));
    expect(deleted.unions.find((u) => u._id.toHexString() === couple)).toMatchObject({ marriageYear: 2008 });
    expect(() => plan(deleted, [{ op: "updateUnion", unionId: couple, set: { status: "divorced" } }])).not.toThrow();
    expectRejected(deleted, [{ op: "updateUnion", unionId: couple, set: { marriageYear: 2009 } }], /a single parent has no marriage date/);
  });

  test("a death year can't be before the birth year", () => {
    expectRejected(empty, [{ op: "createPerson", tempId: "new:1", name: "A", gender: "male", birthYear: 1950, deathYear: 1940 }], /death year/);
    expectRejected(sample, [{ op: "updatePerson", personId: idOf("Jake Cruz"), set: { birthYear: 2030 } }], /death year/);
  });

  test("the error names the failing change in the batch", () => {
    const ops: Operation[] = [
      { op: "createPerson", tempId: "new:1", name: "A", gender: "male" },
      { op: "createPerson", tempId: "new:2", name: "B", gender: "female" },
      { op: "addChild", unionId: "new:9", childId: "new:2" },
    ];
    expectRejected(empty, ops, /^Change 3: /, 2);
  });
});

describe("planOperations: editing by hand (step 6)", () => {
  // Priya Rao, a single mother of Kiran; Priya and Arun Shah are also a couple of their own.
  const withSingleParent = after(
    sample,
    plan(sample, [
      { op: "createPerson", tempId: "new:priya", name: "Priya Rao", gender: "female" },
      { op: "createUnion", tempId: "new:single", partnerIds: ["new:priya"], status: "married" },
      { op: "createPerson", tempId: "new:kiran", name: "Kiran Rao", gender: "male" },
      { op: "addChild", unionId: "new:single", childId: "new:kiran" },
      { op: "createPerson", tempId: "new:arun", name: "Arun Shah", gender: "male" },
      { op: "createUnion", partnerIds: ["new:priya", "new:arun"], status: "divorced" },
    ]),
  );
  const id = (name: string) => withSingleParent.persons.find((p) => p.name === name)!._id.toHexString();
  const single = withSingleParent.unions.find((u) => u.partnerIds.length === 1)!._id.toHexString();

  test("addPartner gives a single parent a partner, who becomes the children's other parent", () => {
    const p = plan(withSingleParent, [
      { op: "createPerson", tempId: "new:ravi", name: "Ravi Rao", gender: "male" },
      { op: "addPartner", unionId: single, personId: "new:ravi" },
    ]);
    const [union] = p.unions.updated;
    expect(union.partnerIds.map((x) => x.toHexString())).toEqual([id("Priya Rao"), p.idMap["new:ravi"]]);
    expect(union.childIds.map((x) => x.toHexString())).toEqual([id("Kiran Rao")]);
  });

  test("addPartner: only for a single parent, a different person, a new couple, and not a descendant", () => {
    const jakeAndTaylor = sample.unions.find((u) => u.partnerIds[0].toHexString() === idOf("Jake Cruz"))!._id.toHexString();
    expectRejected(sample, [{ op: "addPartner", unionId: jakeAndTaylor, personId: idOf("Olivia Cruz") }], /already has two partners/);
    expectRejected(withSingleParent, [{ op: "addPartner", unionId: single, personId: id("Priya Rao") }], /two different people/);
    expectRejected(withSingleParent, [{ op: "addPartner", unionId: single, personId: id("Arun Shah") }], /already a couple/);
    expectRejected(withSingleParent, [{ op: "addPartner", unionId: single, personId: id("Kiran Rao") }], /Kiran Rao is a descendant of this couple/);
  });

  test("updateSheet renames, pins and unpins", () => {
    const sheetId = sample.sheets[0]._id.toHexString();
    const renamed = plan(sample, [{ op: "updateSheet", sheetId, set: { title: "The Cruz family", pinned: false } }]).sheets.updated[0];
    expect(renamed).toMatchObject({ title: "The Cruz family", pinned: false, updatedBy: "tester" });
  });

  test("reorderSheets sets the tab order, and must list every sheet once", () => {
    const cruz = sample.sheets[0]._id.toHexString();
    const create = { op: "createSheet", tempId: "new:jerry", title: "Jerry Willow's family", rootPersonId: idOf("Jerry Willow") } as const;
    const p = plan(sample, [create, { op: "reorderSheets", sheetIds: ["new:jerry", cruz] }]);
    expect(p.sheets.inserted[0].order).toBe(0);
    expect(p.sheets.updated[0].order).toBe(1);
    expectRejected(sample, [create, { op: "reorderSheets", sheetIds: [cruz] }], /every sheet must be listed once/);
    expectRejected(sample, [create, { op: "reorderSheets", sheetIds: [cruz, cruz] }], /listed twice/);
  });

  test("a sheet's root person can't be deleted", () => {
    expectRejected(sample, [{ op: "deletePerson", personId: idOf("Alexander Cruz") }], /Alexander Cruz is the root of the sheet Cruz family/);
  });

  test("deleting a sheet: never a pinned one or the last one; then it's gone, and its root can be deleted (owner request)", () => {
    const cruz = sample.sheets[0]._id.toHexString(); // pinned
    const withJerry = after(sample, plan(sample, [{ op: "createSheet", title: "Jerry Willow's family", rootPersonId: idOf("Jerry Willow") }]));
    const jerry = withJerry.sheets.find((s) => s.title === "Jerry Willow's family")!._id.toHexString();
    expectRejected(withJerry, [{ op: "deletePerson", personId: idOf("Jerry Willow") }], /root of the sheet Jerry Willow's family/);
    expectRejected(withJerry, [{ op: "deleteSheet", sheetId: cruz }], /Cruz family is pinned: unpin it first/);

    const p = plan(withJerry, [{ op: "deleteSheet", sheetId: jerry }]);
    expect(p.sheets.updated[0]).toMatchObject({ title: "Jerry Willow's family", deletedAt: now });
    const gone = after(withJerry, p);
    expect(plan(gone, [{ op: "deletePerson", personId: idOf("Jerry Willow") }]).persons.updated[0].deletedAt).toEqual(now);
    expectRejected(gone, [{ op: "updateSheet", sheetId: jerry, set: { title: "Back" } }], /sheet .* not found/);
    expectRejected(gone, [{ op: "deleteSheet", sheetId: jerry }], /sheet .* not found/);
    expect(plan(gone, [{ op: "reorderSheets", sheetIds: [cruz] }]).sheets.updated).toEqual([]); // the deleted one isn't listed
    expectRejected(gone, [{ op: "updateSheet", sheetId: cruz, set: { pinned: false } }, { op: "deleteSheet", sheetId: cruz }], /a group needs at least one sheet/);
  });

  test("a sheet can leave out the children of one of its root's couples, and only its root's", () => {
    const couple = (a: string, b: string) => sample.unions.find((u) => [a, b].every((n) => u.partnerIds.some((p) => p.toHexString() === idOf(n))))!._id.toHexString();
    const jerrySide = { op: "createSheet", title: "Jerry Willow's family", rootPersonId: idOf("Jerry Willow"), hideChildrenOf: couple("Alexander Cruz", "Jerry Willow") } as const;
    expect(plan(sample, [jerrySide]).sheets.inserted[0].hideChildrenOf?.toHexString()).toBe(jerrySide.hideChildrenOf);
    expect(plan(sample, [{ ...jerrySide, hideChildrenOf: undefined }]).sheets.inserted[0]).not.toHaveProperty("hideChildrenOf");
    expectRejected(sample, [{ ...jerrySide, hideChildrenOf: couple("Jake Cruz", "Taylor Humes") }], /Jerry Willow isn't in the couple whose children the sheet leaves out/);
    expectRejected(sample, [{ ...jerrySide, hideChildrenOf: new ObjectId().toHexString() }], /couple .* not found/);
  });
});

describe("planOperations: deleted parents count as absent (found in the owner's check)", () => {
  const jake = idOf("Jake Cruz");
  const alexanderAndJerry = sample.unions.find((u) => u.childIds.some((c) => c.toHexString() === jake))!._id.toHexString();
  const newParents: Operation[] = [
    { op: "createPerson", tempId: "new:dad", name: "Daniel Cruz", gender: "male" },
    { op: "createPerson", tempId: "new:mum", name: "Rosa Cruz", gender: "female" },
    { op: "createUnion", tempId: "new:parents", partnerIds: ["new:dad", "new:mum"], status: "married" },
    { op: "addChild", unionId: "new:parents", childId: jake },
  ];
  // Without sheets, so the sheet-root rule doesn't stop deleting Alexander.
  const noSheets = { ...sample, sheets: [] };
  const deleteParents = (state: GroupState) =>
    after(state, plan(state, [
      { op: "deletePerson", personId: idOf("Alexander Cruz") },
      { op: "deletePerson", personId: idOf("Jerry Willow") },
    ]));

  test("someone whose parents were both deleted can be given new parents, and leaves the old couple", () => {
    const deleted = deleteParents(noSheets);
    const p = plan(deleted, newParents);
    const old = p.unions.updated.find((u) => u._id.toHexString() === alexanderAndJerry)!;
    expect(old.childIds.map((c) => c.toHexString())).not.toContain(jake);
    expect(p.unions.inserted[0].childIds.map((c) => c.toHexString())).toEqual([jake]);

    // Restoring the old parents afterwards brings them back without Jake: he has one set of parents.
    const reParented = after(deleted, p);
    const restored = after(reParented, plan(reParented, [{ op: "restorePerson", personId: idOf("Jerry Willow") }]));
    expect(restored.unions.filter((u) => u.childIds.some((c) => c.toHexString() === jake))).toHaveLength(1);
  });

  test("while one parent is still there, they still count as parents", () => {
    const oneDeleted = after(noSheets, plan(noSheets, [{ op: "deletePerson", personId: idOf("Jerry Willow") }]));
    expectRejected(oneDeleted, newParents, /Jake Cruz already has parents/);
  });

  test("the other parent takes a deleted parent's place", () => {
    const oneDeleted = after(noSheets, plan(noSheets, [{ op: "deletePerson", personId: idOf("Jerry Willow") }]));
    const p = plan(oneDeleted, [
      { op: "createPerson", tempId: "new:other", name: "Sam Cruz", gender: "male" },
      { op: "addPartner", unionId: alexanderAndJerry, personId: "new:other" },
    ]);
    expect(p.unions.updated[0].partnerIds.map((x) => x.toHexString())).toEqual([idOf("Alexander Cruz"), p.idMap["new:other"]]);
  });

  test("a couple whose partners are all deleted can't be used", () => {
    expectRejected(deleteParents(noSheets), [{ op: "addChild", unionId: alexanderAndJerry, childId: idOf("Emma Young") }], /not found/);
  });
});

describe("planOperations: photos (step 7)", () => {
  const folder = `groups/${groupId.toHexString()}`;
  const setPhoto = (name: string, photoId: string | null): Operation => ({ op: "setPhoto", personId: idOf(name), photoId });
  const personNamed = (state: GroupState, name: string) => state.persons.find((p) => p.name === name)!;
  const withJakesPhoto = after(sample, plan(sample, [setPhoto("Jake Cruz", `${folder}/first-photo`)]));

  test("a photo in the group's folder is saved; one elsewhere is refused", () => {
    expect(personNamed(withJakesPhoto, "Jake Cruz").photoId).toBe(`${folder}/first-photo`);
    expectRejected(sample, [setPhoto("Jake Cruz", `groups/${new ObjectId().toHexString()}/first-photo`)], /isn't in this group's folder/);
    expectRejected(sample, [setPhoto("Jake Cruz", "first-photo")], /isn't in this group's folder/);
  });

  test("a deleted person can't be given a photo", () => {
    const deleted = after(sample, plan(sample, [{ op: "deletePerson", personId: idOf("Jake Cruz") }]));
    expectRejected(deleted, [setPhoto("Jake Cruz", `${folder}/first-photo`)], /not found/);
  });

  test("replacing or removing a photo lists the old one as no longer used", () => {
    const replaced = plan(withJakesPhoto, [setPhoto("Jake Cruz", `${folder}/second-photo`)]);
    expect(replaced.unusedPhotoIds).toEqual([`${folder}/first-photo`]);
    const removed = plan(withJakesPhoto, [setPhoto("Jake Cruz", null)]);
    expect(removed.unusedPhotoIds).toEqual([`${folder}/first-photo`]);
    expect(personNamed(after(withJakesPhoto, removed), "Jake Cruz")).not.toHaveProperty("photoId");
  });

  test("a photo someone else still uses, even a deleted person, isn't listed", () => {
    const shared = after(withJakesPhoto, plan(withJakesPhoto, [setPhoto("Taylor Humes", `${folder}/first-photo`)]));
    expect(plan(shared, [setPhoto("Jake Cruz", null)]).unusedPhotoIds).toEqual([]);
    const taylorDeleted = after(shared, plan(shared, [{ op: "deletePerson", personId: idOf("Taylor Humes") }]));
    expect(plan(taylorDeleted, [setPhoto("Jake Cruz", null)]).unusedPhotoIds).toEqual([]); // Undo brings Taylor's back
  });

  test("setting the same photo again changes nothing", () => {
    const again = plan(withJakesPhoto, [setPhoto("Jake Cruz", `${folder}/first-photo`)]);
    expect(again.persons.updated).toEqual([]);
    expect(again.unusedPhotoIds).toEqual([]);
    expect(plan(sample, [setPhoto("Jake Cruz", null)]).persons.updated).toEqual([]); // no photo to remove
  });
});

describe("operationsSchema", () => {
  test("accepts the sample family's operations", () => {
    expect(operationsSchema.safeParse(sampleOps).success).toBe(true);
  });

  test.each([
    ["an empty batch", []],
    ["an unknown operation", [{ op: "deleteEverything" }]],
    ["unexpected fields", [{ op: "deletePerson", personId: new ObjectId().toHexString(), extra: 1 }]],
    ["a malformed temporary id", [{ op: "createPerson", tempId: "temp1", name: "A", gender: "male" }]],
    ["a blank name", [{ op: "createPerson", tempId: "new:1", name: "  ", gender: "male" }]],
    ["a non-integer year", [{ op: "createPerson", tempId: "new:1", name: "A", gender: "male", birthYear: 1950.5 }]],
    ["three partners", [{ op: "createUnion", partnerIds: ["new:1", "new:2", "new:3"], status: "married" }]],
    ["a photo id that isn't in a group folder", [{ op: "setPhoto", personId: "new:1", photoId: "https://evil.example/x.jpg" }]],
    ["a photo id with a path in it", [{ op: "setPhoto", personId: "new:1", photoId: `groups/${new ObjectId().toHexString()}/../other` }]],
  ])("rejects %s", (_label, input) => {
    expect(operationsSchema.safeParse(input).success).toBe(false);
  });
});
