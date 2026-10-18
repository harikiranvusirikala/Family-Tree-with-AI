import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { OperationError } from "@/server/operations/apply";
import { FATHER_SHEET, newGroupOperations } from "@/server/operations/new-group";
import { NoAccessError } from "@/server/roles";
import { createTestDatabase } from "@test/db";
import { collections, ensureIndexes } from "./documents";
import { loadGroupTree } from "./family";
import { applyGroupChanges, createGroup, deleteGroup, firstSheetId, listGroupsForUser, renameGroup, roleInGroup } from "./groups";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  database = await createTestDatabase();
  await ensureIndexes(database.db);
});
afterAll(async () => {
  await database?.drop();
});

const newUser = () => new ObjectId().toHexString();
const sharma = newGroupOperations({
  groupName: "Sharma family",
  fatherName: "Ravi Sharma",
  motherName: "Anita Sharma",
  child: { name: "Priya Sharma", gender: "female" },
});

describe("groups against MongoDB", () => {
  test("createGroup writes the group, the owner membership and the first family in one go (F2)", async () => {
    const owner = newUser();
    const { groupId, idMap } = await createGroup(database, "Sharma family", sharma, owner);

    const tree = await loadGroupTree(database.db, groupId);
    expect(tree.persons.map((p) => p.name).sort()).toEqual(["Anita Sharma", "Priya Sharma", "Ravi Sharma"]);
    expect(tree.unions).toHaveLength(1);
    expect(tree.sheets.map((s) => [s.title, s.pinned])).toEqual([
      ["Ravi Sharma's family", true],
      ["Anita Sharma's family", true],
    ]);
    expect(await roleInGroup(database.db, groupId, owner, "owner")).toEqual({ role: "owner", group: { id: groupId, name: "Sharma family" } });
    expect(await listGroupsForUser(database.db, owner)).toEqual([{ id: groupId, name: "Sharma family", role: "owner" }]);
    expect(await firstSheetId(database.db, groupId)).toBe(idMap[FATHER_SHEET]);
  });

  test("a batch that fails leaves no group or membership behind", async () => {
    const owner = newUser();
    const broken = [{ op: "createUnion", partnerIds: ["new:nobody"], status: "married" }];
    await expect(createGroup(database, "Broken family", broken, owner)).rejects.toThrow(OperationError);
    const { groups, memberships } = collections(database.db);
    expect(await groups.countDocuments({ name: "Broken family" })).toBe(0);
    expect(await memberships.countDocuments({ userId: new ObjectId(owner) })).toBe(0);
  });

  test("a non-member gets the same NoAccessError for an existing group and a made-up one", async () => {
    const { groupId } = await createGroup(database, "Sharma family", sharma, newUser());
    const stranger = newUser();
    const errors = await Promise.all(
      [groupId, new ObjectId().toHexString(), "not-a-group"].map((id) => roleInGroup(database.db, id, stranger, "view").catch((e: unknown) => e)),
    );
    for (const error of errors) {
      expect(error).toBeInstanceOf(NoAccessError);
      expect((error as Error).message).toBe("No access");
    }
  });

  test("a member below the required role gets NoAccessError", async () => {
    const owner = newUser();
    const viewer = newUser();
    const { groupId } = await createGroup(database, "Rao family", sharma, owner);
    await collections(database.db).memberships.insertOne({
      _id: new ObjectId(),
      groupId: new ObjectId(groupId),
      userId: new ObjectId(viewer),
      role: "view",
      addedBy: owner,
      createdAt: new Date(),
    });
    expect((await roleInGroup(database.db, groupId, viewer, "view")).role).toBe("view");
    await expect(roleInGroup(database.db, groupId, viewer, "maintain")).rejects.toThrow(NoAccessError);
    expect(await listGroupsForUser(database.db, viewer)).toEqual([{ id: groupId, name: "Rao family", role: "view" }]);
  });

  test("one membership per user per group", async () => {
    const owner = newUser();
    const { groupId } = await createGroup(database, "Iyer family", sharma, owner);
    const again = { _id: new ObjectId(), groupId: new ObjectId(groupId), userId: new ObjectId(owner), role: "view" as const, addedBy: owner, createdAt: new Date() };
    await expect(collections(database.db).memberships.insertOne(again)).rejects.toThrow(/duplicate key/);
  });

  test("editing: a Viewer is refused and nothing is written; a Maintainer's change goes through (F6)", async () => {
    const owner = newUser();
    const viewer = newUser();
    const maintainer = newUser();
    const { groupId } = await createGroup(database, "Patel family", sharma, owner);
    for (const [userId, role] of [[viewer, "view"], [maintainer, "maintain"]] as const) {
      await collections(database.db).memberships.insertOne({
        _id: new ObjectId(),
        groupId: new ObjectId(groupId),
        userId: new ObjectId(userId),
        role,
        addedBy: owner,
        createdAt: new Date(),
      });
    }
    const addAunt = [{ op: "createPerson", tempId: "new:aunt", name: "Meena Sharma", gender: "female" }];

    await expect(applyGroupChanges(database, groupId, viewer, addAunt)).rejects.toThrow(NoAccessError);
    await expect(applyGroupChanges(database, groupId, newUser(), addAunt)).rejects.toThrow(NoAccessError);
    expect((await loadGroupTree(database.db, groupId)).persons).toHaveLength(3);

    const { idMap } = await applyGroupChanges(database, groupId, maintainer, addAunt);
    const tree = await loadGroupTree(database.db, groupId);
    expect(tree.persons.map((p) => p.name)).toContain("Meena Sharma");
    const aunt = await collections(database.db).persons.findOne({ _id: new ObjectId(idMap["new:aunt"]) });
    expect(aunt).toMatchObject({ createdBy: maintainer, groupId: new ObjectId(groupId) });
  });

  test("rename, then a soft delete hides the group from everyone and keeps its records", async () => {
    const owner = newUser();
    const { groupId } = await createGroup(database, "Kumar family", sharma, owner);
    await renameGroup(database.db, groupId, "Kumar family tree", owner);
    expect((await roleInGroup(database.db, groupId, owner, "view")).group.name).toBe("Kumar family tree");

    await deleteGroup(database.db, groupId, owner);
    await expect(roleInGroup(database.db, groupId, owner, "owner")).rejects.toThrow(NoAccessError);
    expect(await listGroupsForUser(database.db, owner)).toEqual([]);
    expect(await collections(database.db).persons.countDocuments({ groupId: new ObjectId(groupId) })).toBe(3);
  });
});
