import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, test } from "./fixtures";

const SHEET_URL = /\/g\/([a-f\d]{24})\/s\/([a-f\d]{24})$/;
const NO_GROUPS = "You don't have any family groups yet";

// Next.js keeps recently visited pages in the DOM, hidden, so locate by role: getByRole skips hidden elements.
const textbox = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

/** Fills in the dashboard's "Create a family group" dialog (New group) and waits for the father's sheet. */
async function createGroup(page: Page, groupName: string, father: string, mother: string, me?: "Male" | "Female") {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "New group", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create a family group" })).toBeVisible();
  await textbox(page, "Group name").fill(groupName);
  await textbox(page, "Father's name").fill(father);
  await textbox(page, "Mother's name").fill(mother);
  if (me) await page.getByRole("radio", { name: me, exact: true }).check();
  else await page.getByRole("checkbox", { name: "Add me as their child" }).uncheck();
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(SHEET_URL);
  const [, groupId, sheetId] = page.url().match(SHEET_URL)!;
  return { groupId, sheetId };
}

test("a new user starts empty, creates a group and lands on the father's sheet with both tabs", async ({ page, signIn }) => {
  const user = await signIn(page, "Priya Sharma");
  await page.goto("/dashboard");
  await expect(page.getByText(NO_GROUPS)).toBeVisible();
  // New group opens the form in a dialog, with the user's own name ready; Escape closes it.
  await page.getByRole("button", { name: "New group", exact: true }).click();
  await expect(textbox(page, "Your name")).toHaveValue(user.name);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Create a family group" })).toBeHidden();

  const { groupId, sheetId } = await createGroup(page, "Sharma family", "Ravi Sharma", "Anita Sharma", "Female");
  await expect(page.getByRole("tab")).toHaveText(["★ Everyone", "Ravi Sharma's family", "Anita Sharma's family"]);
  await expect(page.getByRole("tab", { name: "Ravi Sharma's family" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("person-card")).toHaveCount(3);

  // Switching tabs is instant: the URL changes and nothing is asked of the server.
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.getByRole("tab", { name: "Anita Sharma's family" }).click();
  await expect(page.getByRole("tab", { name: "Anita Sharma's family" })).toHaveAttribute("aria-selected", "true");
  await expect(page).not.toHaveURL(new RegExp(`/s/${sheetId}$`));
  await expect(page.getByTestId("person-card")).toHaveCount(2); // her side: the couple's children are on the father's
  expect(requests.filter((url) => url.includes("/g/"))).toEqual([]);

  // Back the way the user came: to the father's tab, then to the dashboard. The browser kept that
  // dashboard from before the group existed; it must now list the group.
  await page.goBack();
  await expect(page.getByRole("tab", { name: "Ravi Sharma's family" })).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(page).toHaveURL("/dashboard");
  const mine = page.getByRole("region", { name: "My groups" });
  await expect(mine.getByRole("link")).toHaveCount(1);
  await expect(mine.getByRole("link")).toContainText(["Sharma family"]);
  await expect(mine.getByRole("link")).toContainText(["Owner"]);
  await expect(page.getByText(NO_GROUPS)).toHaveCount(0);

  // The group's link opens its first pinned sheet; the header link leads back to the dashboard.
  await mine.getByRole("link", { name: /Sharma family/ }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/s/${sheetId}$`));
  await page.getByRole("banner").getByRole("link", { name: "Family Tree", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(mine.getByRole("link")).toContainText(["Sharma family"]);
  await page.goto(`/g/${groupId}`);
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/s/${sheetId}$`));
});

test("a second user sees nothing of the first user's groups, and no access looks the same as no group", async ({ browser, page, signIn }) => {
  await signIn(page, "Ravi Kumar");
  const { groupId, sheetId } = await createGroup(page, "Kumar family", "Mohan Kumar", "Sita Kumar");

  const other = await browser.newPage();
  try {
    await signIn(other, "Meera Iyer");
    await other.goto("/dashboard");
    await expect(other.getByText(NO_GROUPS)).toBeVisible();

    const madeUp = new ObjectId().toHexString();
    const texts: string[] = [];
    for (const path of [`/g/${groupId}/s/${sheetId}`, `/g/${madeUp}/s/${new ObjectId()}`, `/g/${groupId}`, `/g/${madeUp}`, `/g/${groupId}/settings`, "/g/not-a-group"]) {
      await other.goto(path);
      const page = other.getByTestId("no-access");
      await expect(page).toBeVisible();
      texts.push((await page.textContent()) ?? ""); // not innerText, which depends on layout timing
    }
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]).not.toContain("Kumar");
  } finally {
    await other.context().close();
  }
});

test("rename and delete show everywhere, including pages the browser kept", async ({ page, signIn }) => {
  await signIn(page, "Anita Rao");
  const { groupId } = await createGroup(page, "Rao family", "Suresh Rao", "Lakshmi Rao");
  const header = page.getByRole("banner");
  const mine = page.getByRole("region", { name: "My groups" });
  const home = header.getByRole("link", { name: "Family Tree", exact: true });

  // The dashboard is seen with the group listed, so the browser keeps that copy.
  await home.click();
  await expect(mine.getByRole("link")).toContainText(["Rao family"]);
  await mine.getByRole("link", { name: /Rao family/ }).click();
  await header.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Group settings" })).toBeVisible();

  await textbox(page, "Group name").fill("Rao family tree");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(header.getByRole("button", { name: "Rao family tree", exact: true })).toBeVisible(); // the group switcher
  await home.click();
  await expect(mine.getByRole("link")).toContainText(["Rao family tree"]);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Group settings" })).toBeVisible();

  // Deleting waits for the group's name, typed in a dialog: the old name isn't enough.
  await page.getByRole("button", { name: "Delete group…" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete this group" });
  await textbox(page, "Confirm the group's name").fill("Rao family");
  await expect(confirm.getByRole("button", { name: "Delete group", exact: true })).toBeDisabled();
  await textbox(page, "Confirm the group's name").fill("Rao family tree");
  await confirm.getByRole("button", { name: "Delete group", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText(NO_GROUPS)).toBeVisible();
  await expect(mine.getByRole("link")).toHaveCount(0);

  // Back to the deleted group's settings page, which the browser had kept.
  await page.goBack();
  await expect(page.getByTestId("no-access")).toBeVisible();
  await page.goto(`/g/${groupId}`);
  await expect(page.getByTestId("no-access")).toBeVisible();
});
