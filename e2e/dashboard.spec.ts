import { expect, test } from "./fixtures";

// The dashboard (the production look, part 2, an owner request): groups as cards with their counts,
// New group and Import a file in dialogs, Coming up as a card, and a welcome on the first visit.

test.use({ viewport: { width: 1440, height: 900 } });

test("groups are cards with their counts; a card opens its group, and Start a new group opens the form", async ({ page, signIn, sampleGroup }) => {
  const owner = await signIn(page, "Carla Cruz");
  const { groupId } = await sampleGroup(owner);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: `Welcome, ${owner.name}`, level: 1 })).toBeVisible();

  const card = page.getByRole("region", { name: "My groups", exact: true }).getByRole("listitem").filter({ hasText: "Cruz family" });
  await expect(card).toContainText("Owner");
  await expect(card).toContainText("36 people · 12 couples · 1 member");
  await expect(page.getByRole("region", { name: "Shared with me", exact: true })).toContainText("Nobody has shared a group with you yet.");
  await expect(page.getByRole("region", { name: "Coming up", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/dashboard.png", fullPage: true, animations: "disabled" });

  // The dashed card: the same form, in a dialog that Escape closes and gives the focus back.
  const start = page.getByRole("button", { name: /Start a new group/ });
  await start.click();
  const dialog = page.getByRole("dialog", { name: "Create a family group" });
  await expect(dialog.getByRole("textbox", { name: "Group name", exact: true })).toBeFocused();
  await page.screenshot({ path: "test-results/screenshots/new-group-dialog.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(start).toBeFocused();

  await card.getByRole("link", { name: /Cruz family/ }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/s/[a-f\\d]{24}$`));
});

test("a first visit gets a welcome with the two ways to start", async ({ page, signIn }) => {
  await signIn(page, "Priya Sharma");
  await page.goto("/dashboard");
  const welcome = page.getByRole("region", { name: "Get started" });
  await expect(welcome).toContainText("You don't have any family groups yet");
  await expect(welcome.getByRole("button", { name: "New group", exact: true })).toBeVisible();
  await expect(welcome.getByRole("button", { name: "Import a file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New group", exact: true })).toHaveCount(1); // not also at the top
  await page.screenshot({ path: "test-results/screenshots/dashboard-first-visit.png", animations: "disabled" });

  await welcome.getByRole("button", { name: "Import a file" }).click();
  await expect(page.getByRole("dialog", { name: "Import a family file" }).getByRole("region", { name: "Import a family file" })).toBeVisible();
  await page.getByRole("dialog", { name: "Import a family file" }).getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog", { name: "Import a family file" })).toBeHidden();
});
