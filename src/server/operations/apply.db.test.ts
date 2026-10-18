import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildSheetView } from "@/tree/sheet-view";
import { InvalidIdError } from "@/server/ids";
import { ensureIndexes } from "@/server/repositories/documents";
import { loadGroupTree } from "@/server/repositories/family";
import { cruzYoung, inLawParentIds } from "@test/fixtures/cruz-young";
import { createTestDatabase } from "@test/db";
import { applyOperations, OperationError } from "./apply";
import { operationsFromFamily } from "./from-family";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  database = await createTestDatabase();
  await ensureIndexes(database.db);
});
afterAll(async () => {
  await database?.drop();
});

const sampleOps = operationsFromFamily(cruzYoung, [
  { title: "Cruz family", rootPersonId: "alexander-cruz", extraPersonIds: inLawParentIds, pinned: true },
]);
const newGroup = () => new ObjectId().toHexString();
const idOf = (tree: Awaited<ReturnType<typeof loadGroupTree>>, name: string) => tree.persons.find((p) => p.name === name)!.id;

describe("applyOperations against MongoDB", () => {
  test("applies the whole sample family in one transaction", async () => {
    const group = newGroup();
    const { idMap } = await applyOperations(database, group, sampleOps, "tester");
    const tree = await loadGroupTree(database.db, group);
    expect(tree.persons).toHaveLength(36);
    expect(tree.unions).toHaveLength(12);
    expect(tree.sheets).toHaveLength(1);
    expect(buildSheetView(tree, tree.sheets[0]).persons).toHaveLength(36);
    expect(idMap["new:alexander-cruz"]).toBe(idOf(tree, "Alexander Cruz"));
  });

  test("an invalid batch changes nothing", async () => {
    const group = newGroup();
    await applyOperations(database, group, sampleOps, "tester");
    const before = await loadGroupTree(database.db, group);
    const batch = [
      { op: "createPerson", tempId: "new:1", name: "Should Not", gender: "male" },
      { op: "updatePerson", personId: idOf(before, "Steve Cruz"), set: { name: "Changed" } },
      { op: "addChild", unionId: "new:missing", childId: "new:1" },
    ];
    await expect(applyOperations(database, group, batch, "tester")).rejects.toThrow(OperationError);
    await expect(applyOperations(database, group, [{ op: "createPerson", tempId: "bad" }], "tester")).rejects.toThrow(/Change 1/);
    expect(await loadGroupTree(database.db, group)).toEqual(before);
  });

  test("a deleted person disappears everywhere, and undo brings them back", async () => {
    const group = newGroup();
    await applyOperations(database, group, sampleOps, "tester");
    const tree = await loadGroupTree(database.db, group);
    const steve = idOf(tree, "Steve Cruz");

    await applyOperations(database, group, [{ op: "deletePerson", personId: steve }], "tester");
    const deleted = await loadGroupTree(database.db, group);
    expect(deleted.persons.map((p) => p.id)).not.toContain(steve);
    expect(deleted.unions.flatMap((u) => [...u.partnerIds, ...u.childIds])).not.toContain(steve);

    await applyOperations(database, group, [{ op: "restorePerson", personId: steve }], "tester");
    expect(await loadGroupTree(database.db, group)).toEqual(tree);
  });

  test("groups are isolated", async () => {
    const [a, b] = [newGroup(), newGroup()];
    await applyOperations(database, a, sampleOps, "tester");
    await applyOperations(database, b, sampleOps, "tester");
    const treeA = await loadGroupTree(database.db, a);
    const treeB = await loadGroupTree(database.db, b);
    const idsA = new Set(treeA.persons.map((p) => p.id));
    expect(treeB.persons.some((p) => idsA.has(p.id))).toBe(false);
    // A person from group B can't be used in group A's batch.
    await expect(
      applyOperations(database, a, [{ op: "deletePerson", personId: idOf(treeB, "Steve Cruz") }], "tester"),
    ).rejects.toThrow(/not found/);
    expect(await loadGroupTree(database.db, b)).toEqual(treeB);
  });

  test("two edits to the same couple at once both land", async () => {
    const group = newGroup();
    await applyOperations(database, group, sampleOps, "tester");
    const tree = await loadGroupTree(database.db, group);
    const couple = tree.unions.find((u) => u.partnerIds.includes(idOf(tree, "Jane Howell")))!.id;
    const addBaby = (name: string) => [
      { op: "createPerson", tempId: "new:baby", name, gender: "female", birthYear: 2026 },
      { op: "addChild", unionId: couple, childId: "new:baby" },
    ];
    await Promise.all([
      applyOperations(database, group, addBaby("Baby One"), "tester"),
      applyOperations(database, group, addBaby("Baby Two"), "tester"),
    ]);
    const updated = await loadGroupTree(database.db, group);
    const childNames = updated.unions.find((u) => u.id === couple)!.childIds.map((id) => updated.persons.find((p) => p.id === id)!.name);
    expect(childNames).toEqual(expect.arrayContaining(["Baby One", "Baby Two"]));
  });

  test("malformed group ids are rejected", async () => {
    await expect(applyOperations(database, "not-a-group", sampleOps, "tester")).rejects.toThrow(/group not found/);
    await expect(loadGroupTree(database.db, "not-a-group")).rejects.toThrow(InvalidIdError);
  });

  test("ensureIndexes creates the §5 indexes", async () => {
    const names = (await database.db.collection("unions").listIndexes().toArray()).map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(["groupId_1", "groupId_1_partnerIds_1", "groupId_1_childIds_1"]));
  });
});
