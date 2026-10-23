import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Tablets (an owner request after the final check). The "tablet" project runs this file in Chrome's
// iPad emulation: 810 × 1080, touch. Tabs stay; the tools move into the sheet menu; panels stay beside
// the tree.

const cards = (page: Page) => page.getByTestId("person-card");
const card = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("button", { name: new RegExp(`^${name}(,|$)`) });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("not drawn");
  return b;
}

test("tabs, the sheet menu and side panels on a tablet", async ({ page, signIn, sampleGroup }) => {
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await expect(cards(page)).toHaveCount(36);
  const viewport = page.viewportSize()!;

  // The header as on a computer, without the user's name beside the initials.
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Theme" })).toBeVisible(); // one button, opening Day, Night and Follow device
  expect((await box(header.getByRole("button", { name: owner.name }))).width).toBeLessThan(50); // the initials only

  // Tabs, not the picker; the tools are in the sheet menu, and Ask AI is the round button.
  await expect(page.getByRole("tab", { name: "Jerry Willow's family" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sheet" })).toBeHidden();
  for (const name of ["Export", "Import…", "Sheet options"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ask AI" })).toBeVisible();
  await expect(page.locator(".react-flow__minimap")).toBeHidden();

  // Like a phone, the sheet opens zoomed in at its root, names readable (cards are 150 px).
  await expect.poll(async () => (await box(cards(page).filter({ hasText: "Alexander Cruz" }))).width).toBeGreaterThan(105);

  // The eye stays in the row, just before the menu.
  const [eye, menuButton] = [await box(page.getByRole("button", { name: "Hide photos" })), await box(page.getByRole("button", { name: "Sheet menu" }))];
  expect(eye.x + eye.width).toBeLessThanOrEqual(menuButton.x);

  await page.getByRole("button", { name: "Sheet menu" }).click();
  const menu = page.getByRole("menu", { name: "Sheet menu" });
  await expect(menu.getByText("Hide photos")).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "Move right" })).toBeVisible();
  const menuBox = await box(menu);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  // The person panel sits beside the tree, the whole height.
  await card(page, "Jerry Willow").tap();
  const panel = page.getByRole("complementary", { name: "Person details" });
  await expect(panel.getByRole("heading", { name: "Jerry Willow" })).toBeVisible();
  const panelBox = await box(panel);
  const canvas = await box(page.getByRole("tabpanel"));
  expect(panelBox.x).toBeGreaterThanOrEqual(canvas.x + canvas.width - 1);
  expect(panelBox.height).toBeCloseTo(canvas.height, 0);
  // Jerry's card stays in the tree, now narrower, rather than behind the panel.
  await expect.poll(async () => {
    const jerry = await box(cards(page).filter({ hasText: "Jerry Willow" }));
    return jerry.x >= canvas.x && jerry.x + jerry.width <= canvas.x + canvas.width;
  }).toBe(true);
  await page.screenshot({ path: "test-results/screenshots/tablet-tree.png" });

  for (const path of [`/g/${groupId}/s/${cruzSheet}`, "/dashboard", `/g/${groupId}/members`, `/g/${groupId}/settings`]) {
    await page.goto(path);
    await expect(page.getByRole("banner")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
});

test("★ Everyone opens on the Network on a tablet, as on a computer (owner request)", async ({ page, signIn, sampleGroup }) => {
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await page.getByRole("tab", { name: "★ Everyone" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/everyone\\?view=network$`));
  await expect(page.getByRole("group", { name: "View" }).getByRole("button", { name: "Network" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tabpanel").getByTestId("network-person")).toHaveCount(36);
});
