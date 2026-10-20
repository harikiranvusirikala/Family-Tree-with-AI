import type { Locator, Page } from "@playwright/test";
import { applyOperations } from "@/server/operations/apply";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

// ★ Everyone, part 1: the tab and the Tree view (an owner request after the final check).

test.use({ viewport: { width: 1600, height: 1000 } });

const cards = (page: Page) => page.getByRole("tabpanel").getByTestId("person-card");
const card = (page: Page, name: string) => cards(page).filter({ hasText: name });
const personPanel = (page: Page) => page.getByRole("complementary", { name: "Person details" });
const find = (page: Page) => page.getByRole("combobox", { name: "Find someone" });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("not drawn");
  return b;
}

/** A new owner of a group holding the sample family. */
async function sampleOwner(page: Page, signIn: SignIn, sampleGroup: SampleGroup) {
  const owner = await signIn(page, "Carla Cruz");
  return { owner, ...(await sampleGroup(owner)) };
}

test("a group opens on its first pinned sheet; ★ Everyone, the first tab, shows everyone at its own address", async ({ page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}`);
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
  await expect(page.getByRole("tab", { name: "Cruz family" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab")).toHaveText(["★ Everyone", "Cruz family", "Jerry Willow's family"]);

  await page.getByRole("tab", { name: "★ Everyone" }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/s/everyone$`));
  await expect(page.getByRole("tab", { name: "★ Everyone" })).toHaveAttribute("aria-selected", "true");
  await expect(cards(page)).toHaveCount(36);
  await expect(page.getByText("36 people · 12 couples")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sheet options" })).toHaveCount(0); // nothing to rename, pin, move or delete
  await expect(page.getByRole("button", { name: "+ New sheet" })).toBeVisible();
  await page.waitForTimeout(300); // let the tree settle for the picture
  await page.screenshot({ path: "test-results/screenshots/everyone-tree.png" });

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/s/everyone$`)); // not sent back to the first sheet
  await expect(cards(page)).toHaveCount(36);
  await page.getByRole("tab", { name: "Jerry Willow's family" }).click();
  await expect(cards(page)).toHaveCount(32);
  await page.goBack();
  await expect(page.getByRole("tab", { name: "★ Everyone" })).toHaveAttribute("aria-selected", "true");
});

test("Find someone selects them and brings their card into view; Go to a sheet that shows them, and Back", async ({ page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/everyone`);
  await expect(cards(page)).toHaveCount(36);

  await find(page).fill("amelia");
  await page.getByRole("option", { name: "Amelia Young (2001)" }).click();
  await expect(personPanel(page).getByRole("heading", { name: "Amelia Young" })).toBeVisible();
  await expect(find(page)).toHaveValue("");
  const canvas = await box(page.getByRole("tabpanel"));
  await expect.poll(async () => {
    const amelia = await box(card(page, "Amelia Young"));
    return amelia.width > 105 && amelia.x >= canvas.x && amelia.x + amelia.width <= canvas.x + canvas.width && amelia.y >= canvas.y && amelia.y + amelia.height <= canvas.y + canvas.height;
  }).toBe(true); // zoomed in to read, and on the screen

  // Taylor Humes has no sheet of her own: the panel offers the first sheet that shows her.
  await find(page).fill("taylor h");
  await find(page).press("Enter");
  await expect(personPanel(page).getByRole("heading", { name: "Taylor Humes" })).toBeVisible();
  await personPanel(page).getByRole("button", { name: "Go to Cruz family" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
  await expect(personPanel(page).getByRole("heading", { name: "Taylor Humes" })).toBeVisible(); // still selected
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/s/everyone$`));
  await expect(page.getByRole("tab", { name: "★ Everyone" })).toHaveAttribute("aria-selected", "true");
});

test("someone on no sheet shows on ★ Everyone only", async ({ page, signIn, sampleGroup, database }) => {
  const { owner, groupId, cruzSheet } = await sampleOwner(page, signIn, sampleGroup);
  await applyOperations(database, groupId, [{ op: "createPerson", tempId: "new:zoe", name: "Zoë Ávila", gender: "female", birthYear: 1990 }], owner.id);

  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await expect(cards(page)).toHaveCount(36);
  await page.getByRole("tab", { name: "Jerry Willow's family" }).click();
  await expect(cards(page)).toHaveCount(32);
  await page.getByRole("tab", { name: "★ Everyone" }).click();
  await expect(cards(page)).toHaveCount(37);
  await expect(page.getByText("37 people · 12 couples")).toBeVisible();

  await find(page).fill("zoe");
  await page.getByRole("option", { name: "Zoë Ávila (1990)" }).click();
  await expect(personPanel(page).getByRole("heading", { name: "Zoë Ávila" })).toBeVisible();
  await expect(personPanel(page).getByRole("button", { name: /^Go to / })).toHaveCount(0); // on no sheet
  await expect(personPanel(page).getByRole("button", { name: "Show on another sheet" })).toBeVisible();
});

test("Export on ★ Everyone: a picture named Everyone, and no data for 'this sheet'", async ({ page, signIn, sampleGroup }) => {
  const { groupId } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/everyone`);
  await expect(cards(page)).toHaveCount(36);
  await page.getByRole("button", { name: "Export" }).click();
  const menu = page.getByRole("menu", { name: "Export" });
  await expect(menu.getByRole("menuitem")).toHaveText(["Picture (PNG)", "Print or save as PDF", "Data: whole group (GEDCOM)", "Data: whole group (JSON)"]);
  await expect(menu.getByText("Everyone", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: "Picture (PNG)" }).click();
  expect((await download).suggestedFilename()).toBe("Everyone.png");
});

test("a Viewer gets ★ Everyone too, without edit controls", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId } = await sampleOwner(page, signIn, sampleGroup);
  const viewerPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    const viewer = await signIn(viewerPage, "Vera Viewer");
    await addMember(groupId, viewer, "view");
    await viewerPage.goto(`/g/${groupId}`);
    await viewerPage.getByRole("tab", { name: "★ Everyone" }).click();
    await expect(cards(viewerPage)).toHaveCount(36);
    await find(viewerPage).fill("jerry");
    await find(viewerPage).press("Enter");
    await expect(personPanel(viewerPage).getByRole("button", { name: "Go to Jerry Willow's family" })).toBeVisible();
    await expect(personPanel(viewerPage).getByRole("button", { name: "Edit details" })).toHaveCount(0);
  } finally {
    await viewerPage.context().close();
  }
});
