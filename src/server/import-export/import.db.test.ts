import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { operationsFromFamily } from "@/server/operations/from-family";
import { collections, ensureIndexes } from "@/server/repositories/documents";
import { loadGroupTree } from "@/server/repositories/family";
import { applyGroupChanges, createGroup, roleInGroup } from "@/server/repositories/groups";
import { createTestDatabase } from "@test/db";
import { cruzYoung } from "@test/fixtures/cruz-young";
import { exportGedcom, parseGedcom } from "./gedcom";
import { findDuplicates, importOperations } from "./import-plan";
import type { ImportData } from "./types";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  database = await createTestDatabase();
  await ensureIndexes(database.db);
});
afterAll(async () => {
  await database?.drop();
});

const cruz = operationsFromFamily(cruzYoung, [{ title: "Cruz family", rootPersonId: "alexander-cruz", pinned: true }]);

describe("imports against MongoDB (F10)", () => {
  test("a GEDCOM export imported into a new group: everyone, with the importer as Owner, in one go", async () => {
    const owner = new ObjectId().toHexString();
    const { groupId } = await createGroup(database, "Cruz family", cruz, owner);
    const exported = exportGedcom(await loadGroupTree(database.db, groupId));

    const importer = new ObjectId().toHexString();
    const data = parseGedcom(exported, "cruz.ged") as ImportData;
    const batch = importOperations(data, { genders: {}, useExisting: {}, intoExistingGroup: false }, { persons: [], unions: [], sheets: [] });
    if (typeof batch === "string") throw new Error(batch);
    const imported = await createGroup(database, "Cruz family (imported)", batch.operations, importer);

    const tree = await loadGroupTree(database.db, imported.groupId);
    expect(tree.persons).toHaveLength(36);
    expect(tree.unions).toHaveLength(cruzYoung.unions.length);
    expect(tree.sheets).toMatchObject([{ id: imported.idMap[batch.firstSheet], pinned: true }]);
    expect((await roleInGroup(database.db, imported.groupId, importer, "owner")).role).toBe("owner");
  });

  test("Use existing links the file's people to the group's, and a Viewer can't import", async () => {
    const owner = new ObjectId().toHexString();
    const { groupId } = await createGroup(database, "Cruz family", cruz, owner);
    const before = await loadGroupTree(database.db, groupId);
    const data = parseGedcom(
      "0 HEAD\n0 @J@ INDI\n1 NAME Jake /Cruz/\n1 SEX M\n1 BIRT\n2 DATE 1945\n" +
        "0 @T@ INDI\n1 NAME Taylor /Humes/\n1 SEX F\n1 BIRT\n2 DATE 1955\n" +
        "0 @M@ INDI\n1 NAME Mia /Cruz/\n1 SEX F\n0 @F@ FAM\n1 HUSB @J@\n1 WIFE @T@\n1 CHIL @M@\n0 TRLR\n",
    ) as ImportData;
    const useExisting = Object.fromEntries(findDuplicates(data, before).map((d) => [d.imported.id, d.existing[0].id]));
    expect(Object.keys(useExisting)).toEqual(["@J@", "@T@"]);
    const batch = importOperations(data, { genders: {}, useExisting, targetGroupId: groupId, intoExistingGroup: true }, before);
    if (typeof batch === "string") throw new Error(batch);

    const viewer = new ObjectId().toHexString();
    await collections(database.db).memberships.insertOne({ _id: new ObjectId(), groupId: new ObjectId(groupId), userId: new ObjectId(viewer), role: "view", addedBy: owner, createdAt: new Date() });
    await expect(applyGroupChanges(database, groupId, viewer, batch.operations)).rejects.toThrow("No access");

    await applyGroupChanges(database, groupId, owner, batch.operations);
    const after = await loadGroupTree(database.db, groupId);
    expect(after.persons).toHaveLength(37);
    const mia = after.persons.find((p) => p.name === "Mia Cruz")!;
    const parents = after.unions.find((u) => u.childIds.includes(mia.id))!.partnerIds;
    expect(parents.map((id) => after.persons.find((p) => p.id === id)!.name).sort()).toEqual(["Jake Cruz", "Taylor Humes"]);
  });
});
