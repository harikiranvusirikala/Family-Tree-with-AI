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

/** Invites an email from the members page's dialog; the new invite's token, from the link shown to share. */
async function invite(page: Page, groupId: string, email: string, role: string) {
  await page.goto(`/g/${groupId}/members`);
  await page.getByRole("button", { name: "Invite people" }).click();
  const form = page.getByRole("form", { name: "Invite someone" });
  await form.getByRole("textbox", { name: "Email" }).fill(email);
  await form.getByRole("radio", { name: role, exact: true }).check();
  await form.getByRole("button", { name: "Invite", exact: true }).click();
  const link = form.getByRole("textbox", { name: "New invite link" });
  await expect(link).toHaveValue(/\/invite\/[\w-]{43}$/);
  const token = (await link.inputValue()).split("/invite/")[1];
  await form.getByRole("button", { name: "Done" }).click();
  await expect(form).toBeHidden();
  return token;
}

/** Creates an invite link from the members page's card; its token, from the link shown to share. */
async function createLink(page: Page, groupId: string, role: string, limit?: number) {
  await page.goto(`/g/${groupId}/members`);
  await region(page, "Invite links").getByRole("button", { name: "Create a link" }).click();
  const form = page.getByRole("form", { name: "Create an invite link" });
  await form.getByRole("radio", { name: role, exact: true }).check();
  if (limit) {
    await form.getByRole("checkbox", { name: "Limit the number of people" }).check();
    await form.getByRole("spinbutton", { name: "At most" }).fill(String(limit));
  }
  await form.getByRole("button", { name: "Create link" }).click();
  const link = form.getByRole("textbox", { name: "New invite link" });
  await expect(link).toHaveValue(/\/join\/[\w-]{43}$/);
  const token = (await link.inputValue()).split("/join/")[1];
  await form.getByRole("button", { name: "Done" }).click();
  await expect(form).toBeHidden();
  return token;
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
    await expect(cousin.page.getByRole("button", { name: "New sheet", exact: true })).toBeVisible(); // Maintain edits

    await cousin.page.getByRole("banner").getByRole("link", { name: "Family Tree", exact: true }).click();
    await expect(row(cousin.page, "Shared with me", "Cruz family")).toContainText("Maintain");
    await expect(region(cousin.page, "Invitations")).toHaveCount(0);
    await page.goto(`/g/${groupId}/members`);
    await expect(row(page, "People", "Cousin Ravi").getByRole("button", { name: "Role for Cousin Ravi: Maintain" })).toBeVisible();
    await expect(region(page, "Invites waiting").getByRole("listitem")).toHaveCount(0);
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

    await row(page, "Invites waiting", invited.user.email).getByRole("button", { name: "Revoke" }).click();
    await expect(row(page, "Invites waiting", invited.user.email)).toHaveCount(0);
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
    await expect(row(page, "People", "Priya Sharma").getByRole("button", { name: "Role for Priya Sharma: Maintain" })).toBeVisible();

    await asker.page.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cards(asker.page)).toHaveCount(36);
    await expect(asker.page.getByRole("button", { name: "New sheet", exact: true })).toBeVisible();
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
      await expect(p.getByRole("main")).toContainText("Only Admins and the Owner manage members.");
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

test("a changed role shows in its menu without a reload (found in the owner's check)", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId } = await ownerWithGroup(page, signIn, sampleGroup);
  const member = await someoneElse(browser, signIn, "Vera Viewer");
  try {
    await addMember(groupId, member.user, "view");
    await page.goto(`/g/${groupId}/members`);
    const vera = row(page, "People", "Vera Viewer");
    const menu = page.getByRole("menu", { name: "Role for Vera Viewer" });
    for (const label of ["Maintain", "Admin"]) {
      await vera.getByRole("button", { name: /^Role for Vera Viewer: / }).click();
      await menu.getByRole("menuitemradio", { name: label }).click();
      await expect(vera.getByRole("status")).toHaveText("Role changed.");
      await expect(vera.getByRole("button", { name: `Role for Vera Viewer: ${label}` })).toBeVisible();
    }
    // The menu ticks the saved role, which a reload shows too.
    await vera.getByRole("button", { name: "Role for Vera Viewer: Admin" }).click();
    await expect(menu.getByRole("menuitemradio", { name: "Admin" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await page.reload();
    await expect(vera.getByRole("button", { name: "Role for Vera Viewer: Admin" })).toBeVisible();
    await member.page.goto(`/g/${groupId}/members`);
    await expect(member.page.getByRole("button", { name: "Invite people" })).toBeVisible(); // now an Admin
  } finally {
    await member.page.context().close();
  }
});

test("Remove from group asks first: Escape keeps them, Remove takes their access away", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId } = await ownerWithGroup(page, signIn, sampleGroup);
  const member = await someoneElse(browser, signIn, "Vera Viewer");
  try {
    await addMember(groupId, member.user, "view");
    await page.goto(`/g/${groupId}/members`);
    await expect(page.getByRole("main")).toContainText("2 people can see Cruz family.");
    const vera = row(page, "People", "Vera Viewer");
    const options = vera.getByRole("button", { name: "Options for Vera Viewer" });
    const dialog = page.getByRole("dialog", { name: "Remove Vera Viewer?" });
    const ask = async () => {
      await options.click();
      await page.getByRole("menu", { name: "Options for Vera Viewer" }).getByRole("menuitem", { name: "Remove from group…" }).click();
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    };
    await ask();
    await expect(dialog).toContainText("They lose access to Cruz family straight away.");
    await page.screenshot({ path: "test-results/screenshots/remove-member.png", animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(options).toBeFocused();

    await ask();
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(vera).toHaveCount(0);
    await expect(page.getByRole("main")).toContainText("1 person can see Cruz family.");
    await member.page.goto(`/g/${groupId}`);
    await expect(member.page.getByTestId("no-access")).toBeVisible();
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
    const ownerRow = row(admin.page, "People", "Carla Cruz");
    await expect(ownerRow).toContainText("Owner");
    await expect(ownerRow.getByRole("button")).toHaveCount(0); // no role menu, no Remove
    await expect(row(admin.page, "People", "Ada Admin").getByRole("button", { name: "Options for Ada Admin" })).toHaveCount(0); // leaving is in Settings

    await page.goto(`/g/${groupId}/settings`);
    await page.getByRole("combobox", { name: "New owner" }).selectOption({ label: "Ada Admin (Admin)" });
    await page.getByRole("button", { name: "Transfer ownership…" }).click();
    const transfer = page.getByRole("dialog", { name: "Transfer ownership" });
    await expect(transfer).toContainText("Make Ada Admin the owner of Cruz family?");
    await transfer.getByRole("textbox", { name: "Confirm the group's name" }).fill("Cruz family");
    await transfer.getByRole("button", { name: "Transfer ownership", exact: true }).click();
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

test("the members and settings pages as cards (the production look): the side menu, the dialogs and screenshots", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId, cruzSheet } = await ownerWithGroup(page, signIn, sampleGroup);
  const asker = await someoneElse(browser, signIn, "Priya Sharma");
  const people = await Promise.all(["Steve Cruz", "Olivia Cruz"].map((name) => someoneElse(browser, signIn, name)));
  try {
    await requestAccess(asker.page, `/g/${groupId}/s/${cruzSheet}`, "I'm Jake's niece");
    await addMember(groupId, people[0].user, "admin");
    await addMember(groupId, people[1].user, "maintain");
    await invite(page, groupId, "ravi.kumar@example.com", "View");
    await expect(page.getByRole("main")).toContainText("3 people can see Cruz family.");
    await expect(row(page, "Access requests", "Priya Sharma")).toContainText("I'm Jake's niece");
    await expect(row(page, "Invites waiting", "ravi.kumar@example.com")).toContainText("View · invited by Carla Cruz");
    await page.screenshot({ path: "test-results/screenshots/members.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Invite people" }).click();
    await expect(page.getByRole("form", { name: "Invite someone" }).getByRole("textbox", { name: "Email" })).toBeFocused();
    await page.screenshot({ path: "test-results/screenshots/invite-dialog.png", animations: "disabled" });
    await page.keyboard.press("Escape");
    await row(page, "People", "Olivia Cruz").getByRole("button", { name: "Role for Olivia Cruz: Maintain" }).click();
    await expect(page.getByRole("menu", { name: "Role for Olivia Cruz" }).getByRole("menuitemradio", { name: "Maintain" })).toBeFocused();
    await page.screenshot({ path: "test-results/screenshots/role-menu.png", animations: "disabled" });
    await page.keyboard.press("Escape");

    await page.getByRole("banner").getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Group settings" })).toBeVisible();
    const sections = page.getByRole("navigation", { name: "Settings sections" });
    await expect(sections.getByRole("link", { name: "General" })).toHaveAttribute("aria-current", "true");
    await page.screenshot({ path: "test-results/screenshots/settings.png", fullPage: true, animations: "disabled" });
    await sections.getByRole("link", { name: "Danger zone" }).click();
    await expect(sections.getByRole("link", { name: "Danger zone" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("button", { name: "Delete group…" })).toBeInViewport();
    await page.getByRole("button", { name: "Delete group…" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete this group" });
    await expect(dialog).toContainText("Cruz family disappears for everyone in it (3 members).");
    await expect(dialog.getByRole("button", { name: "Delete group", exact: true })).toBeDisabled();
    await page.screenshot({ path: "test-results/screenshots/delete-dialog.png", animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  } finally {
    for (const { page: p } of [asker, ...people]) await p.context().close();
  }
});

test("an invite link (owner request): signed out, it goes through sign-in; two people join as Viewers; Revoke stops it", async ({ browser, page, signIn, sampleGroup }) => {
  const { groupId } = await ownerWithGroup(page, signIn, sampleGroup);
  const token = await createLink(page, groupId, "View");
  const links = region(page, "Invite links");
  await expect(links.getByRole("listitem")).toContainText("0 people joined · made by Carla Cruz");
  await page.screenshot({ path: "test-results/screenshots/invite-links.png", fullPage: true, animations: "disabled" });

  const stranger = await browser.newPage({ viewport });
  await stranger.goto(`/join/${token}`);
  await expect(stranger).toHaveURL(`/?returnTo=${encodeURIComponent(`/join/${token}`)}`);
  await stranger.context().close();

  const people = await Promise.all(["Asha Rao", "Ravi Rao"].map((name) => someoneElse(browser, signIn, name)));
  try {
    for (const person of people) {
      await person.page.goto(`/join/${token}`);
      await expect(person.page.getByRole("heading", { name: "Join Cruz family" })).toBeVisible();
      await expect(person.page.getByTestId("invite")).toContainText("Carla Cruz invited you to join Cruz family as View.");
      await person.page.getByRole("button", { name: "Join Cruz family" }).click();
      await expect(person.page).toHaveURL(new RegExp(`/g/${groupId}/s/`));
      await expect(cards(person.page)).toHaveCount(36);
      await expect(person.page.getByRole("button", { name: "New sheet", exact: true })).toHaveCount(0); // View only
    }
    await people[0].page.goto(`/join/${token}`); // a member again: straight to the tree
    await expect(people[0].page).toHaveURL(new RegExp(`/g/${groupId}`));

    await page.goto(`/g/${groupId}/members`);
    await expect(links.getByRole("listitem")).toContainText("2 people joined");
    await links.getByText("Who joined").click();
    await expect(links.getByRole("listitem")).toContainText("Asha Rao, Ravi Rao");
    await expect(row(page, "People", "Asha Rao")).toContainText("Joined by link");
    await expect(row(page, "People", "Asha Rao").getByRole("button", { name: "Role for Asha Rao: View" })).toBeVisible();

    await links.getByRole("button", { name: "Revoke View link" }).click();
    const dialog = page.getByRole("dialog", { name: "Revoke this link?" });
    await dialog.getByRole("button", { name: "Revoke", exact: true }).click();
    await expect(links.getByRole("listitem")).toHaveCount(0);
    await expect(row(page, "People", "Ravi Rao")).toBeVisible(); // those who joined stay

    const late = await someoneElse(browser, signIn, "Late Leela");
    try {
      await late.page.goto(`/join/${token}`);
      await expect(late.page.getByRole("heading", { name: "This invite link isn't valid any more." })).toBeVisible();
      await expect(late.page.getByTestId("invite")).not.toContainText("Cruz family");
    } finally {
      await late.page.context().close();
    }
  } finally {
    for (const person of people) await person.page.context().close();
  }
});

test("an invite link with a limit: once it's reached the link shows Used up and lets nobody else in", async ({ browser, page, signIn, sampleGroup }) => {
  const { groupId } = await ownerWithGroup(page, signIn, sampleGroup);
  const token = await createLink(page, groupId, "Maintain", 1);
  const first = await someoneElse(browser, signIn, "First Farah");
  const second = await someoneElse(browser, signIn, "Second Sam");
  try {
    await first.page.goto(`/join/${token}`);
    await expect(first.page.getByTestId("invite")).toContainText("as Maintain.");
    await first.page.getByRole("button", { name: "Join Cruz family" }).click();
    await expect(first.page.getByRole("button", { name: "New sheet", exact: true })).toBeVisible(); // Maintain edits

    await second.page.goto(`/join/${token}`);
    await expect(second.page.getByRole("heading", { name: "This invite link isn't valid any more." })).toBeVisible();

    await page.goto(`/g/${groupId}/members`);
    const link = region(page, "Invite links").getByRole("listitem");
    await expect(link).toContainText("Used up");
    await expect(link).toContainText("1 of 1 joined");
    await expect(link.getByRole("button", { name: /Copy link/ })).toHaveCount(0);
  } finally {
    await first.page.context().close();
    await second.page.context().close();
  }
});
