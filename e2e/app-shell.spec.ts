import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The app shell (the production look, part 1, an owner request): the header on every signed-in page,
// its menus, and the pages that say one thing (not found, no access).

test.use({ viewport: { width: 1440, height: 900 } });

const SHEET_URL = /\/g\/([a-f\d]{24})\/s\/([a-f\d]{24})$/;
const textbox = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
// Animations finished first: a menu caught mid-fade looks see-through.
const shot = (page: Page, name: string, height = 900) =>
  page.screenshot({ path: `test-results/screenshots/${name}.png`, clip: { x: 0, y: 0, width: 1440, height }, animations: "disabled" });

test("the header: the group's switcher changes groups, and its pages are tabs with the open one marked", async ({ page, signIn, sampleGroup }) => {
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  // A second group, made on the dashboard.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "New group", exact: true }).click();
  await textbox(page, "Group name").fill("Rao family");
  await textbox(page, "Father's name").fill("Suresh Rao");
  await textbox(page, "Mother's name").fill("Lakshmi Rao");
  await page.getByRole("checkbox", { name: "Add me as their child" }).uncheck();
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(SHEET_URL);

  const header = page.getByRole("banner");
  const tabs = header.getByRole("navigation", { name: "This family tree" });
  await expect(tabs.getByRole("link", { name: "Tree" })).toHaveAttribute("aria-current", "page");
  await header.getByRole("button", { name: "Rao family", exact: true }).click();
  const trees = page.getByRole("menu", { name: "Your groups" });
  await expect(trees.getByRole("menuitemradio", { name: "Rao family" })).toHaveAttribute("aria-checked", "true");
  await trees.getByRole("menuitemradio", { name: "Cruz family" }).click();
  await expect(page).toHaveURL(`/g/${groupId}/s/${cruzSheet}`);
  await expect(header.getByRole("button", { name: "Cruz family", exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel").getByTestId("person-card")).toHaveCount(36);
  await shot(page, "header", 120);

  await tabs.getByRole("link", { name: "Members" }).click();
  await expect(page.getByRole("heading", { name: "Members", level: 1 })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Members" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Group settings" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");

  // Every family tree, from the switcher.
  await header.getByRole("button", { name: "Cruz family", exact: true }).click();
  await shot(page, "group-switcher", 320);
  await page.getByRole("menu", { name: "Your groups" }).getByRole("menuitem", { name: "All groups" }).click();
  await expect(page).toHaveURL("/dashboard");
});

test("the theme menu works from the keyboard, and the account menu says who's signed in", async ({ page, signIn, sampleGroup }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  const theme = page.getByRole("banner").getByRole("button", { name: "Theme" });
  await expect(theme).toBeEnabled(); // once React knows the choice
  await theme.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Theme" });
  await expect(menu.getByRole("menuitemradio", { name: "Follow device" })).toBeFocused(); // the current choice
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio", { name: "Night" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(menu).toBeHidden();
  await expect(theme).toBeFocused();
  await shot(page, "night-header", 120);

  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(theme).toBeFocused();

  await page.getByRole("banner").getByRole("button", { name: owner.name }).click();
  const account = page.getByRole("menu", { name: "Account" });
  await expect(account).toContainText(owner.email);
  await expect(account.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await shot(page, "night-account-menu", 360);
});

test("an address that doesn't exist gets the app's own page, with a way back", async ({ page, signIn }) => {
  await signIn(page, "Ada Lovelace");
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page isn't here" })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/not-found.png" });
  await page.getByRole("link", { name: "Go to your dashboard" }).click();
  await expect(page).toHaveURL("/dashboard");
});

test("a family tree someone can't open says so on a card, the same for every group", async ({ page, signIn }) => {
  await signIn(page, "Ada Lovelace");
  await page.goto(`/g/${"0".repeat(24)}`);
  await expect(page.getByTestId("no-access").getByRole("heading", { name: "You don't have access to this family tree" })).toBeVisible();
  await expect(page.getByTestId("no-access").getByRole("button", { name: "Request access" })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/no-access.png" });
});
