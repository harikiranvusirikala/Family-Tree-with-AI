import type { Browser, Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { REQUEST_DENIED, REQUEST_SENT } from "@/components/request-messages";
import { collections } from "@/server/repositories/documents";
import { expect, test, type SampleGroup, type SignIn, type TestUser } from "./fixtures";

const viewport = { width: 1400, height: 1000 };
test.use({ viewport });

const cards = (page: Page) => page.getByTestId("person-card");
const region = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const row = (page: Page, regionName: string, text: string) => region(page, regionName).getByRole("listitem").filter({ hasText: text });

/** The owner of a new group holding the sample family, signed in on `page`. */
async function ownerWithGroup(page: Page, signIn: SignIn, sampleGroup: SampleGroup) {
  const owner = await signIn(page, "Carla Cruz");
  return { owner, ...(await sampleGroup(owner)) };
}

/** Another person, signed in on their own page. Close it with `page.context().close()`. */
async function someoneElse(browser: Browser, signIn: SignIn, name: string): Promise<{ page: Page; user: TestUser }> {
  const page = await browser.newPage({ viewport });
  return { page, user: await signIn(page, name) };
}

/** Invites an email from the members page; the new invite's token, from the link shown to share. */
async function invite(page: Page, groupId: string, email: string, role: string) {
  await page.goto(`/g/${groupId}/members`);
  const form = page.getByRole("form", { name: "Invite someone" });
  await form.getByRole("textbox", { name: "Email" }).fill(email);
  await form.getByRole("combobox", { name: "Role", exact: true }).selectOption({ label: role });
  await form.getByRole("button", { name: "Invite" }).click();
  const link = form.getByRole("textbox", { name: "New invite link" });
  await expect(link).toHaveValue(/\/invite\/[\w-]{43}$/);
  return (await link.inputValue()).split("/invite/")[1];
}

/** Asks for access from a tree link, with a message. */
async function requestAccess(page: Page, path: string, message: string) {
  await page.goto(path);
  const noAccess = page.getByTestId("no-access");
  await noAccess.getByRole("textbox", { name: "Message for the admins (optional)" }).fill(message);
  await noAccess.getByRole("button", { name: "Request access" }).click();
  await expect(noAccess.getByRole("status")).toHaveText(REQUEST_SENT);
}

test("invite by email: the invitee sees it on the tree link and the dashboard, accepts, and can edit", async ({ browser, page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await ownerWithGroup(page, signIn, sampleGroup);
  const cousin = await someoneElse(browser, signIn, "Cousin Ravi");
  try {
    const token = await invite(page, groupId, cousin.user.email, "Maintain");

    await cousin.page.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cousin.page.getByTestId("no-access").getByRole("link", { name: "See the invite" })).toBeVisible();
    await cousin.page.goto("/dashboard");
    await expect(row(cousin.page, "Invitations", "Cruz family")).toContainText("Carla Cruz invited you as Maintain");

    await cousin.page.goto(`/invite/${token}`);
    await expect(cousin.page.getByRole("heading", { name: "Join Cruz family" })).toBeVisible();
    await expect(cousin.page.getByTestId("invite")).toContainText("Carla Cruz invited you to join Cruz family as Maintain.");
    await cousin.page.getByRole("button", { name: "Accept the invite to Cruz family" }).click();
    await expect(cousin.page).toHaveURL(new RegExp(`/g/${groupId}/s/`));
    await expect(cards(cousin.page)).toHaveCount(36);
    await expect(cousin.page.getByRole("button", { name: "+ New sheet" })).toBeVisible(); // Maintain edits

    await cousin.page.getByRole("banner").getByRole("link", { name: "Family Tree", exact: true }).click();
    await expect(row(cousin.page, "Shared with me", "Cruz family")).toContainText("Maintain");
    await expect(region(cousin.page, "Invitations")).toHaveCount(0);
    await page.goto(`/g/${groupId}/members`);
    await expect(row(page, "Members", "Cousin Ravi").getByRole("combobox")).toHaveValue("maintain");
    await expect(region(page, "Invites").getByRole("listitem")).toHaveCount(0);
  } finally {
    await cousin.page.context().close();
  }
});

test("an invite works only for its email, until it's revoked or expires; Decline drops it", async ({ browser, page, signIn, sampleGroup, database }) => {
  const { groupId } = await ownerWithGroup(page, signIn, sampleGroup);
  const invited = await someoneElse(browser, signIn, "Invited Iris");
  const other = await someoneElse(browser, signIn, "Other Omar");
  const invalid = (p: Page) => expect(p.getByRole("heading", { name: "This invite link isn't valid any more." })).toBeVisible();
  try {
    const token = await invite(page, groupId, invited.user.email, "View");
    await other.page.goto(`/invite/${token}`);
    await expect(other.page.getByRole("heading", { name: "This invite is for another account" })).toBeVisible();
    await expect(other.page.getByTestId("invite")).toContainText(`This invite is for ${invited.user.email[0]}*****@example.com.`);
    expect(await other.page.getByTestId("invite").textContent()).not.toContain("Cruz"); // nothing about the group
    await expect(other.page.getByRole("button", { name: "Sign in with another account" })).toBeVisible();

    await row(page, "Invites", invited.user.email).getByRole("button", { name: "Revoke" }).click();
    await expect(row(page, "Invites", invited.user.email)).toHaveCount(0);
    await invited.page.goto(`/invite/${token}`);
    await invalid(invited.page);

    const second = await invite(page, groupId, invited.user.email, "View");
    await collections(database.db).invites.updateOne({ token: second }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await invited.page.goto(`/invite/${second}`);
    await invalid(invited.page);

    const third = await invite(page, groupId, invited.user.email, "View"); // inviting again makes it work again
    await invited.page.goto(`/invite/${third}`);
    await invited.page.getByRole("button", { name: "Decline the invite to Cruz family" }).click();
    await expect(invited.page).toHaveURL("/dashboard");
    await expect(region(invited.page, "Invitations")).toHaveCount(0);
    await invited.page.goto(`/invite/${third}`);
    await invalid(invited.page);
  } finally {
    await invited.page.context().close();
    await other.page.context().close();
  }
});

test("request access, approved as Maintain: the badge shows it, and the requester can edit", async ({ browser, page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await ownerWithGroup(page, signIn, sampleGroup);
  const asker = await someoneElse(browser, signIn, "Priya Sharma");
  try {
    await requestAccess(asker.page, `/g/${groupId}/s/${cruzSheet}`, "I'm Jake's niece");
    await asker.page.reload();
    await expect(asker.page.getByTestId("no-access").getByRole("status")).toHaveText(REQUEST_SENT);
    await asker.page.goto("/dashboard");
    const mine = region(asker.page, "My access requests");
    await expect(mine).toContainText("Waiting for an admin");
    await expect(mine).toContainText("I'm Jake's niece");
    expect(await mine.textContent()).not.toContain("Cruz");

    await page.goto("/dashboard");
    await expect(row(page, "My groups", "Cruz family")).toContainText("1 access request");
    await page.goto(`/g/${groupId}/s/${cruzSheet}`);
    await page.getByRole("banner").getByRole("link", { name: "Members, 1 access request" }).click();
    const request = row(page, "Access requests", "Priya Sharma");
    await expect(request).toContainText("I'm Jake's niece");
    await request.getByRole("combobox", { name: "Role for Priya Sharma" }).selectOption({ label: "Maintain" });
    await request.getByRole("button", { name: "Approve" }).click();
    await expect(region(page, "Access requests")).toContainText("No requests waiting.");
    await expect(row(page, "Members", "Priya Sharma").getByRole("combobox")).toHaveValue("maintain");

    await asker.page.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cards(asker.page)).toHaveCount(36);
    await expect(asker.page.getByRole("button", { name: "+ New sheet" })).toBeVisible();
    await asker.page.goto("/dashboard");
    await expect(row(asker.page, "Shared with me", "Cruz family")).toContainText("Maintain");
    await expect(region(asker.page, "My access requests")).toHaveCount(0);
  } finally {
    await asker.page.context().close();
  }
});

test("request access, denied: the requester sees it and can't ask again", async ({ browser, page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await ownerWithGroup(page, signIn, sampleGroup);
  const asker = await someoneElse(browser, signIn, "Denied Dev");
  try {
    await requestAccess(asker.page, `/g/${groupId}/s/${cruzSheet}`, "hello");
    await page.goto(`/g/${groupId}/members`);
    await row(page, "Access requests", "Denied Dev").getByRole("button", { name: "Deny" }).click();
    await expect(region(page, "Access requests")).toContainText("No requests waiting.");

    await asker.page.reload();
    await expect(asker.page.getByTestId("no-access")).toContainText(REQUEST_DENIED);
    await expect(asker.page.getByRole("button", { name: "Request access" })).toHaveCount(0);
    await asker.page.goto("/dashboard");
    await expect(region(asker.page, "My access requests")).toContainText("Declined");
  } finally {
    await asker.page.context().close();
  }
});

test("Viewers and Maintainers get no members page or badge; Admins do", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId, cruzSheet } = await ownerWithGroup(page, signIn, sampleGroup);
  const asker = await someoneElse(browser, signIn, "Waiting Wanda");
  const people = await Promise.all(["Vera Viewer", "Max Maintainer", "Ada Admin"].map((name) => someoneElse(browser, signIn, name)));
  try {
    await requestAccess(asker.page, `/g/${groupId}/s/${cruzSheet}`, "please");
    const [viewer, maintainer, admin] = people;
    await addMember(groupId, viewer.user, "view");
    await addMember(groupId, maintainer.user, "maintain");
    await addMember(groupId, admin.user, "admin");

    for (const { page: p } of [viewer, maintainer]) {
      await p.goto(`/g/${groupId}/s/${cruzSheet}`);
      await expect(cards(p)).toHaveCount(36);
      await expect(p.getByRole("banner").getByRole("link", { name: /^Members/ })).toHaveCount(0);
      await p.goto(`/g/${groupId}/members`);
      await expect(p.getByRole("main")).toHaveText("Only Admins and the Owner manage members.");
      await p.goto("/dashboard");
      await expect(row(p, "Shared with me", "Cruz family")).not.toContainText("access request");
    }
    await admin.page.goto(`/g/${groupId}/s/${cruzSheet}`);
    await admin.page.getByRole("banner").getByRole("link", { name: "Members, 1 access request" }).click();
    await expect(row(admin.page, "Access requests", "Waiting Wanda")).toBeVisible();
  } finally {
    for (const { page: p } of [asker, ...people]) await p.context().close();
  }
});

test("a changed role shows in its dropdown without a reload (found in the owner's check)", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId } = await ownerWithGroup(page, signIn, sampleGroup);
  const member = await someoneElse(browser, signIn, "Vera Viewer");
  try {
    await addMember(groupId, member.user, "view");
    await page.goto(`/g/${groupId}/members`);
    const vera = row(page, "Members", "Vera Viewer");
    const role = vera.getByRole("combobox", { name: "Role for Vera Viewer" });
    for (const [label, value] of [["Maintain", "maintain"], ["Admin", "admin"]]) {
      await role.selectOption({ label });
      await vera.getByRole("button", { name: "Change role" }).click();
      await expect(vera.getByRole("status")).toHaveText("Role changed.");
      await expect(role).toHaveValue(value); // React resets the form after the action; it must reset to the new role
      await expect(role.locator("option:checked")).toHaveText(label);
    }
    await member.page.goto(`/g/${groupId}/members`);
    await expect(member.page.getByRole("heading", { name: "Members" })).toBeVisible(); // now an Admin
  } finally {
    await member.page.context().close();
  }
});

test("an Admin can't remove or demote the Owner; the Owner transfers ownership, then leaves", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId } = await ownerWithGroup(page, signIn, sampleGroup);
  const admin = await someoneElse(browser, signIn, "Ada Admin");
  try {
    await addMember(groupId, admin.user, "admin");
    await admin.page.goto(`/g/${groupId}/members`);
    const ownerRow = row(admin.page, "Members", "Carla Cruz");
    await expect(ownerRow).toContainText("Owner");
    await expect(ownerRow.getByRole("combobox")).toHaveCount(0);
    await expect(ownerRow.getByRole("button")).toHaveCount(0);

    await page.goto(`/g/${groupId}/settings`);
    const transfer = page.getByRole("form", { name: "Transfer ownership" });
    await transfer.getByRole("combobox", { name: "New owner" }).selectOption({ label: "Ada Admin (Admin)" });
    await transfer.getByRole("textbox", { name: "Confirm the group's name" }).fill("Cruz family");
    await transfer.getByRole("button", { name: "Transfer ownership" }).click();
    await expect(page.getByRole("main")).toContainText("You're an Admin. Only the group's owner, Ada Admin, can rename, transfer or delete it.");

    await admin.page.goto(`/g/${groupId}/settings`);
    await expect(admin.page.getByRole("button", { name: "Delete group" })).toBeVisible();

    await page.getByRole("button", { name: "Leave this group" }).click();
    await page.getByRole("button", { name: "Leave", exact: true }).click();
    await expect(page).toHaveURL("/dashboard");
    // It was their only group: the dashboard welcomes them as on a first visit.
    await expect(page.getByRole("region", { name: "Get started" })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("Cruz family");
  } finally {
    await admin.page.context().close();
  }
});

test("a request for a made-up group looks the same as for a real one", async ({ browser, page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await ownerWithGroup(page, signIn, sampleGroup);
  const asker = await someoneElse(browser, signIn, "Curious Kim");
  try {
    const paths = [`/g/${groupId}/s/${cruzSheet}`, `/g/${new ObjectId()}/s/${new ObjectId()}`];
    const texts: string[] = [];
    for (const path of paths) {
      await requestAccess(asker.page, path, "hi");
      await asker.page.reload();
      texts.push((await asker.page.getByTestId("no-access").textContent()) ?? "");
    }
    expect(texts[0]).toBe(texts[1]);
    await asker.page.goto("/dashboard");
    const mine = region(asker.page, "My access requests");
    await expect(mine.getByRole("listitem")).toHaveCount(2);
    await expect(mine.getByRole("listitem").filter({ hasText: "Waiting for an admin" })).toHaveCount(2);
  } finally {
    await asker.page.context().close();
  }
});
