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
    expectRejected(sample, [{ op: "updateUnion", unionId: missing, status: "divorced" }], /couple .* not found/);
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
  ])("rejects %s", (_label, input) => {
    expect(operationsSchema.safeParse(input).success).toBe(false);
  });
});
