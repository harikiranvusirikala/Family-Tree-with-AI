import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { MemberError } from "@/server/members-rules";
import { newGroupOperations } from "@/server/operations/new-group";
import { NoAccessError, type Role } from "@/server/roles";
import { createTestDatabase } from "@test/db";
import { accessState, decideRequest, MAX_PENDING_REQUESTS, myRequests, pendingRequestCounts, requestAccess } from "./access-requests";
import { collections, ensureIndexes } from "./documents";
import { createGroup, deleteGroup, listGroupsForUser, roleInGroup } from "./groups";
import { acceptInvite, createInvite, declineInvite, INVALID_INVITE, inviteForToken, invitesForUser, listInvites, revokeInvite } from "./invites";
import { changeRole, leaveGroup, listMembers, memberCounts, removeMember, transferOwnership } from "./members";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  database = await createTestDatabase();
  await ensureIndexes(database.db);
});
afterAll(async () => {
  await database?.drop();
});

interface User {
  id: string;
  name: string;
  email: string;
}

/** A user as Better Auth would store them. */
async function newUser(name: string, email = `${name.toLowerCase().replace(/\W+/g, ".")}.${new ObjectId().toHexString().slice(-6)}@example.com`): Promise<User> {
  const _id = new ObjectId();
  await collections(database.db).users.insertOne({ _id, name, email });
  return { id: _id.toHexString(), name, email };
}

/** A new group owned by a new user, with a member for each given role. */
async function group(roles: Role[] = []) {
  const owner = await newUser("Olivia Owner");
  const ops = newGroupOperations({ groupName: "Sharma family", fatherName: "Ravi Sharma", motherName: "Anita Sharma" });
  const { groupId } = await createGroup(database, "Sharma family", ops, owner.id);
  const members: User[] = [];
  for (const role of roles) {
    const member = await newUser(`${role} member`);
    await collections(database.db).memberships.insertOne({
      _id: new ObjectId(),
      groupId: new ObjectId(groupId),
      userId: new ObjectId(member.id),
      role,
      addedBy: owner.id,
      createdAt: new Date(),
    });
    members.push(member);
  }
  return { groupId, owner, members };
}

const roleOf = async (groupId: string, user: User) => (await roleInGroup(database.db, groupId, user.id, "view").catch(() => null))?.role ?? null;

describe("invites (F3)", () => {
  test("accepting creates the membership once, with the invited role", async () => {
    const { groupId, owner } = await group();
    const cousin = await newUser("Cousin Ravi", "Cousin.Ravi+family@gmail.com");
    const { token } = await createInvite(database.db, groupId, owner.id, { email: "cousinravi@gmail.com", role: "maintain" });

    expect(await invitesForUser(database.db, cousin)).toMatchObject([{ token, groupName: "Sharma family", role: "maintain", invitedBy: "Olivia Owner" }]);
    expect(await acceptInvite(database, token, cousin)).toBe(groupId); // gmail dots and +tags don't matter
    expect(await roleOf(groupId, cousin)).toBe("maintain");
    await expect(acceptInvite(database, token, cousin)).rejects.toThrow("This invite link isn't valid any more.");
    expect(await collections(database.db).memberships.countDocuments({ userId: new ObjectId(cousin.id) })).toBe(1);
    expect(await invitesForUser(database.db, cousin)).toEqual([]);
  });

  test("another account, an expired, revoked or declined invite, and a deleted group are refused", async () => {
    const { groupId, owner } = await group();
    const invited = await newUser("Invited Person");
    const other = await newUser("Other Person");
    const { token } = await createInvite(database.db, groupId, owner.id, { email: invited.email, role: "view" });
    await expect(acceptInvite(database, token, other)).rejects.toThrow(new RegExp(`This invite is for ${invited.email[0]}\\*{5}@example\\.com`));

    const later = new Date(Date.now() + 15 * 86_400_000);
    await expect(acceptInvite(database, token, invited, later)).rejects.toThrow("isn't valid any more");
    expect(await inviteForToken(database.db, token, later)).toBeNull();

    await revokeInvite(database.db, groupId, owner.id, (await listInvites(database.db, groupId))[0].id);
    await expect(acceptInvite(database, token, invited)).rejects.toThrow("isn't valid any more");

    const second = await createInvite(database.db, groupId, owner.id, { email: invited.email, role: "view" });
    await declineInvite(database.db, second.token, other); // not theirs: ignored
    expect(await inviteForToken(database.db, second.token)).not.toBeNull();
    await declineInvite(database.db, second.token, invited);
    expect(await inviteForToken(database.db, second.token)).toBeNull();

    const third = await createInvite(database.db, groupId, owner.id, { email: invited.email, role: "view" });
    await deleteGroup(database.db, groupId, owner.id);
    await expect(acceptInvite(database, third.token, invited)).rejects.toThrow("isn't valid any more");
    expect(await roleOf(groupId, invited)).toBeNull();
  });

  test("a crafted token, such as a query object sent to the server action, matches no invite (step 11's review)", async () => {
    const { groupId, owner } = await group();
    const invited = await newUser("Invited Person");
    const other = await newUser("Other Person");
    await createInvite(database.db, groupId, owner.id, { email: invited.email, role: "view" });
    // Server actions accept whatever the caller sends, so a token can arrive as { $regex: "^a" }:
    // that would find others' invites (and their masked emails) one character at a time.
    for (const crafted of [{ $regex: "." }, { $ne: "" }] as unknown as string[]) {
      await expect(acceptInvite(database, crafted, other)).rejects.toThrow(INVALID_INVITE);
      expect(await inviteForToken(database.db, crafted)).toBeNull();
      await declineInvite(database.db, crafted, invited);
    }
    expect(await invitesForUser(database.db, invited)).toHaveLength(1); // still pending
  });

  test("inviting again refreshes the pending invite and keeps its link; inviting a member is refused", async () => {
    const { groupId, owner, members } = await group(["view"]);
    const first = await createInvite(database.db, groupId, owner.id, { email: "Aunt.Meena@Example.com", role: "view" });
    const again = await createInvite(database.db, groupId, owner.id, { email: "aunt.meena@example.com", role: "admin" });
    expect(again.token).toBe(first.token);
    expect(await listInvites(database.db, groupId)).toMatchObject([{ role: "admin", email: "aunt.meena@example.com" }]);
    await expect(createInvite(database.db, groupId, owner.id, { email: members[0].email.toUpperCase(), role: "view" })).rejects.toThrow(/already a member/);
  });

  test("only Admins and the Owner invite and revoke", async () => {
    const { groupId, members } = await group(["view", "maintain", "admin"]);
    const [viewer, maintainer, admin] = members;
    for (const user of [viewer, maintainer, await newUser("Stranger")]) {
      await expect(createInvite(database.db, groupId, user.id, { email: "x@example.com", role: "view" })).rejects.toThrow(NoAccessError);
      await expect(revokeInvite(database.db, groupId, user.id, new ObjectId().toHexString())).rejects.toThrow(NoAccessError);
    }
    await expect(createInvite(database.db, groupId, admin.id, { email: "x@example.com", role: "admin" })).resolves.toHaveProperty("token");
  });
});

describe("access requests (F4)", () => {
  test("request, approve as Maintain: a member with that role, and their invite is closed too", async () => {
    const { groupId, owner } = await group();
    const asker = await newUser("Priya Asker");
    await createInvite(database.db, groupId, owner.id, { email: asker.email, role: "view" });
    expect(await requestAccess(database.db, groupId, asker, "I'm Ravi's niece")).toBe("sent");
    expect(await requestAccess(database.db, groupId, asker, undefined)).toBe("sent"); // still one request
    expect(await accessState(database.db, groupId, asker)).toMatchObject({ request: "pending", inviteToken: expect.any(String) });
    expect(await myRequests(database.db, asker.id)).toMatchObject([{ groupId, status: "pending", message: "I'm Ravi's niece" }]);
    expect((await pendingRequestCounts(database.db, [groupId])).get(groupId)).toBe(1);

    const [request] = await collections(database.db).accessRequests.find({ groupId: new ObjectId(groupId) }).toArray();
    await decideRequest(database, groupId, owner.id, request._id.toHexString(), "maintain");
    expect(await roleOf(groupId, asker)).toBe("maintain");
    expect(await myRequests(database.db, asker.id)).toEqual([]);
    expect(await invitesForUser(database.db, asker)).toEqual([]);
    await expect(decideRequest(database, groupId, owner.id, request._id.toHexString(), "deny")).rejects.toThrow("already been answered");
  });

  test("deny: the person sees it, and can't ask again", async () => {
    const { groupId, members } = await group(["admin"]);
    const asker = await newUser("Asker");
    await requestAccess(database.db, groupId, asker, undefined);
    const [request] = await collections(database.db).accessRequests.find({ groupId: new ObjectId(groupId) }).toArray();
    await decideRequest(database, groupId, members[0].id, request._id.toHexString(), "deny");
    expect(await accessState(database.db, groupId, asker)).toEqual({ request: "denied" });
    expect(await myRequests(database.db, asker.id)).toMatchObject([{ status: "denied" }]);
    expect(await requestAccess(database.db, groupId, asker, "please")).toBe("declined");
    expect(await roleOf(groupId, asker)).toBeNull();
  });

  test("a made-up group's request is kept like a real one's; a malformed id is answered but not saved", async () => {
    const { groupId } = await group();
    const asker = await newUser("Asker");
    const madeUp = new ObjectId().toHexString();
    expect(await requestAccess(database.db, groupId, asker, undefined)).toBe("sent");
    expect(await requestAccess(database.db, madeUp, asker, undefined)).toBe("sent");
    expect(await accessState(database.db, madeUp, asker)).toEqual(await accessState(database.db, groupId, asker));
    expect((await myRequests(database.db, asker.id)).map((r) => r.status)).toEqual(["pending", "pending"]);
    expect(await requestAccess(database.db, "not-a-group", asker, undefined)).toBe("sent");
    expect(await myRequests(database.db, asker.id)).toHaveLength(2);
  });

  test(`at most ${MAX_PENDING_REQUESTS} pending requests per person`, async () => {
    const asker = await newUser("Busy Asker");
    for (let i = 0; i < MAX_PENDING_REQUESTS; i++) await requestAccess(database.db, new ObjectId().toHexString(), asker, undefined);
    await expect(requestAccess(database.db, new ObjectId().toHexString(), asker, undefined)).rejects.toThrow(MemberError);
  });

  test("only Admins and the Owner answer requests", async () => {
    const { groupId, members } = await group(["view", "maintain"]);
    const asker = await newUser("Asker");
    await requestAccess(database.db, groupId, asker, undefined);
    const [request] = await collections(database.db).accessRequests.find({ groupId: new ObjectId(groupId) }).toArray();
    for (const user of members) {
      await expect(decideRequest(database, groupId, user.id, request._id.toHexString(), "admin")).rejects.toThrow(NoAccessError);
    }
    expect(await roleOf(groupId, asker)).toBeNull();
  });

  test("accepting an invite approves a pending request; someone removed later can ask again", async () => {
    const { groupId, owner } = await group();
    const person = await newUser("Person");
    await requestAccess(database.db, groupId, person, undefined);
    const { token } = await createInvite(database.db, groupId, owner.id, { email: person.email, role: "view" });
    await acceptInvite(database, token, person);
    expect(await myRequests(database.db, person.id)).toEqual([]);

    await removeMember(database.db, groupId, owner.id, person.id);
    expect(await requestAccess(database.db, groupId, person, "me again")).toBe("sent");
    expect(await accessState(database.db, groupId, person)).toEqual({ request: "pending" });
  });
});

describe("members and the Owner (§8)", () => {
  test("memberCounts: each group's members, the Owner included (the dashboard's cards)", async () => {
    const one = await group(["view", "admin"]);
    const two = await group();
    const counts = await memberCounts(database.db, [one.groupId, two.groupId]);
    expect(counts.get(one.groupId)).toBe(3);
    expect(counts.get(two.groupId)).toBe(1);
    expect((await memberCounts(database.db, [])).size).toBe(0);
  });

  test("Admins change roles and remove members, other Admins included, but never the Owner", async () => {
    const { groupId, owner, members } = await group(["admin", "admin", "view"]);
    const [admin, otherAdmin, viewer] = members;
    await changeRole(database.db, groupId, admin.id, viewer.id, "maintain");
    expect(await roleOf(groupId, viewer)).toBe("maintain");
    await changeRole(database.db, groupId, admin.id, otherAdmin.id, "view");
    expect(await roleOf(groupId, otherAdmin)).toBe("view");

    await expect(changeRole(database.db, groupId, admin.id, owner.id, "view")).rejects.toThrow(/owner's role can't be changed/);
    await expect(removeMember(database.db, groupId, admin.id, owner.id)).rejects.toThrow(/owner can't be removed/);
    await expect(changeRole(database.db, groupId, viewer.id, admin.id, "view")).rejects.toThrow(NoAccessError); // now Maintain
    await removeMember(database.db, groupId, admin.id, viewer.id);
    expect(await roleOf(groupId, viewer)).toBeNull();
    expect((await listMembers(database.db, groupId)).map((m) => m.role)).toEqual(["owner", "admin", "view"]);
    expect((await listMembers(database.db, groupId)).every((m) => m.joinedAt instanceof Date)).toBe(true); // the members page's Joined
  });

  test("transfer leaves exactly one Owner, and the old one becomes an Admin", async () => {
    const { groupId, owner, members } = await group(["maintain", "admin"]);
    const [maintainer, admin] = members;
    await expect(transferOwnership(database, groupId, admin.id, maintainer.id)).rejects.toThrow(NoAccessError);
    await expect(transferOwnership(database, groupId, owner.id, owner.id)).rejects.toThrow(MemberError);
    await transferOwnership(database, groupId, owner.id, maintainer.id);
    expect(await roleOf(groupId, maintainer)).toBe("owner");
    expect(await roleOf(groupId, owner)).toBe("admin");
    expect(await collections(database.db).memberships.countDocuments({ groupId: new ObjectId(groupId), role: "owner" })).toBe(1);
    expect(await listGroupsForUser(database.db, owner.id)).toMatchObject([{ id: groupId, role: "admin" }]);
  });

  test("members leave; the Owner can't", async () => {
    const { groupId, owner, members } = await group(["view"]);
    await leaveGroup(database.db, groupId, members[0].id);
    expect(await roleOf(groupId, members[0])).toBeNull();
    await expect(leaveGroup(database.db, groupId, owner.id)).rejects.toThrow(/Transfer ownership/);
  });
});
