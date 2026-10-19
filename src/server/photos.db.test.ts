import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setPhotoOps } from "@/tree/edits";
import { createTestDatabase } from "@test/db";
import type { CloudinaryConfig } from "./cloudinary";
import { OperationError } from "./operations/apply";
import { newGroupOperations } from "./operations/new-group";
import { PhotosNotSetUpError, signPhotoUpload } from "./photos";
import { collections, ensureIndexes } from "./repositories/documents";
import { loadGroupTree } from "./repositories/family";
import { applyGroupChanges, createGroup } from "./repositories/groups";
import { NoAccessError, type Role } from "./roles";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  database = await createTestDatabase();
  await ensureIndexes(database.db);
});
afterAll(async () => {
  await database?.drop();
});

const config: CloudinaryConfig = { cloudName: "demo", apiKey: "1234", apiSecret: "shh", apiUrl: "https://api.cloudinary.com" };
const newUser = () => new ObjectId().toHexString();

/** A new group with the Sharma family, its owner, and a member for each given role. */
async function sharmaGroup(roles: Role[] = []) {
  const owner = newUser();
  const ops = newGroupOperations({ groupName: "Sharma family", fatherName: "Ravi Sharma", motherName: "Anita Sharma" });
  const { groupId, idMap } = await createGroup(database, "Sharma family", ops, owner);
  const members = roles.map(() => newUser());
  await Promise.all(
    roles.map((role, i) =>
      collections(database.db).memberships.insertOne({
        _id: new ObjectId(),
        groupId: new ObjectId(groupId),
        userId: new ObjectId(members[i]),
        role,
        addedBy: owner,
        createdAt: new Date(),
      }),
    ),
  );
  return { groupId, owner, members, ravi: idMap["new:father"] };
}

describe("photos against MongoDB (F8)", () => {
  test("only Maintain and up get an upload signature, for their group's folder", async () => {
    const { groupId, members } = await sharmaGroup(["view", "maintain"]);
    const [viewer, maintainer] = members;
    for (const [group, user] of [[groupId, viewer], [groupId, newUser()], [new ObjectId().toHexString(), maintainer]]) {
      await expect(signPhotoUpload(database.db, group, user, config)).rejects.toThrow(NoAccessError);
    }
    const ticket = await signPhotoUpload(database.db, groupId, maintainer, config);
    expect(ticket.publicId.startsWith(`groups/${groupId}/`)).toBe(true);
    expect(ticket.fields.tags).toBe(database.db.databaseName);
    await expect(signPhotoUpload(database.db, groupId, maintainer, undefined)).rejects.toThrow(PhotosNotSetUpError);
  });

  test("a photo from another group's folder is refused and nothing is written", async () => {
    const { groupId, owner, ravi } = await sharmaGroup();
    const other = new ObjectId().toHexString();
    await expect(applyGroupChanges(database, groupId, owner, setPhotoOps(ravi, `groups/${other}/someone-else`))).rejects.toThrow(OperationError);
    expect((await loadGroupTree(database.db, groupId)).persons.find((p) => p.id === ravi)).not.toHaveProperty("photoId");
  });

  test("replacing a photo saves the new one and gives back the old one to delete", async () => {
    const { groupId, owner, ravi } = await sharmaGroup();
    const first = `groups/${groupId}/first-photo`;
    const second = `groups/${groupId}/second-photo`;
    expect((await applyGroupChanges(database, groupId, owner, setPhotoOps(ravi, first))).unusedPhotoIds).toEqual([]);
    expect((await applyGroupChanges(database, groupId, owner, setPhotoOps(ravi, second))).unusedPhotoIds).toEqual([first]);
    const saved = await collections(database.db).persons.findOne({ _id: new ObjectId(ravi) });
    expect(saved).toMatchObject({ photoId: second, updatedBy: owner });
  });
});
