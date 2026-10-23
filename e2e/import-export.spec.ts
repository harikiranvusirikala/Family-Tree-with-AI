import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { collections } from "@/server/repositories/documents";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

test.use({ viewport: { width: 1600, height: 1000 } });

const cards = (page: Page) => page.getByTestId("person-card");
const card = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("button", { name: new RegExp(`^${name}(,|$)`) });

async function openSampleGroup(page: Page, signIn: SignIn, sampleGroup: SampleGroup) {
  const owner = await signIn(page, "Carla Cruz");
  const group = await sampleGroup(owner);
  await page.goto(`/g/${group.groupId}/s/${group.cruzSheet}`);
  await expect(cards(page)).toHaveCount(36);
  return { owner, ...group };
}

/** Picks an item in the Export menu and returns the downloaded file. */
async function exportItem(page: Page, item: string) {
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menu", { name: "Export" }).getByRole("menuitem", { name: item }).click();
  return download;
}

/**
 * Whether a person would see the element: the topmost thing at its centre is the element itself.
 * Playwright scrolls clipped elements into view before acting, so a menu cut off by a scrolling
 * parent still passes a click; this doesn't scroll.
 */
async function onScreen(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!top && (top === element || element.contains(top));
  });
}

test("the Export menu opens where it can be seen (found in the owner's check)", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  await page.getByRole("button", { name: "Export" }).click();
  const menu = page.getByRole("menu", { name: "Export" });
  for (const item of await menu.getByRole("menuitem").all()) expect(await onScreen(item)).toBe(true);
});

test("export the group as GEDCOM and JSON, then import the GEDCOM into a new group", async ({ page, signIn, sampleGroup, database }) => {
  await openSampleGroup(page, signIn, sampleGroup);

  const gedcom = await exportItem(page, "Data: whole group (GEDCOM)");
  expect(gedcom.suggestedFilename()).toBe("Cruz family.ged");
  const gedcomPath = await gedcom.path();
  const text = await readFile(gedcomPath, "utf8");
  expect(text.startsWith("0 HEAD\n")).toBe(true);
  expect(text.match(/ INDI$/gm)).toHaveLength(36);
  expect(text).toContain("1 NAME Jake /Cruz/");

  const json = JSON.parse(await readFile(await (await exportItem(page, "Data: whole group (JSON)")).path(), "utf8"));
  expect(json).toMatchObject({ format: "family-tree-with-ai", version: 1, group: { name: "Cruz family" } });
  expect(json.persons).toHaveLength(36);
  expect(json.sheets.map((s: { title: string }) => s.title)).toEqual(["Cruz family", "Jerry Willow's family"]);
  const sheet = JSON.parse(await readFile(await (await exportItem(page, "Data: this sheet (JSON)")).path(), "utf8"));
  expect(sheet.persons).toHaveLength(36);
  expect(sheet.sheets).toHaveLength(1);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Import a file" }).click();
  const panel = page.getByRole("region", { name: "Import a family file" });
  const chooser = page.waitForEvent("filechooser");
  await panel.getByRole("button", { name: "Choose a file" }).click();
  await (await chooser).setFiles(gedcomPath);
  await expect(panel.getByRole("status")).toHaveText(`36 people, ${json.unions.length} couples`);
  await panel.getByRole("textbox", { name: "Name of the new group" }).fill("Cruz copy");
  await panel.getByRole("combobox", { name: "The new sheet shows the family of" }).selectOption({ label: "Alexander Cruz (1918 – 2003)" });
  await panel.getByRole("button", { name: "Import" }).click();

  await expect(page).toHaveURL(/\/g\/[a-f\d]{24}\/s\/[a-f\d]{24}$/);
  await expect(page.getByRole("tab", { name: "Alexander Cruz's family" })).toBeVisible();
  const groupId = new URL(page.url()).pathname.split("/")[2];
  expect(await collections(database.db).persons.countDocuments({ groupId: new ObjectId(groupId) })).toBe(36);
  await page.getByRole("banner").getByRole("link", { name: "Family Tree", exact: true }).click();
  await expect(page.getByRole("region", { name: "My groups", exact: true }).getByRole("listitem").filter({ hasText: "Cruz copy" })).toContainText("Owner");
});

test("import into this group: duplicates linked with Use existing, and a sex chosen in the preview", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  await page.getByRole("button", { name: "Import…" }).click();
  const panel = page.getByRole("region", { name: "Import a family file" });
  const chooser = page.waitForEvent("filechooser");
  await panel.getByRole("button", { name: "Choose a file" }).click();
  await (await chooser).setFiles({
    name: "mia.ged",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "0 HEAD\n1 CHAR UTF-8\n0 @J@ INDI\n1 NAME Jake /Cruz/\n1 SEX M\n1 BIRT\n2 DATE 1945\n" +
        "0 @T@ INDI\n1 NAME Taylor /Humes/\n1 SEX F\n1 BIRT\n2 DATE 1955\n" +
        "0 @M@ INDI\n1 NAME Mia /Cruz/\n1 BIRT\n2 DATE 12 MAY 1992\n2 PLAC Boston\n" +
        "0 @F@ FAM\n1 HUSB @J@\n1 WIFE @T@\n1 CHIL @M@\n0 TRLR\n",
    ),
  });
  await expect(panel.getByRole("status")).toHaveText("3 people, 1 couple");
  await expect(panel).toContainText("Not kept: places."); // exact dates are kept whole (an owner request)

  await panel.getByRole("button", { name: "Import" }).click();
  await expect(panel.getByRole("alert")).toHaveText("Choose male or female for Mia Cruz.");
  await panel.getByRole("combobox", { name: "Sex of Mia Cruz" }).selectOption("female");
  await expect(panel.getByRole("alert")).toHaveCount(0); // answered
  // Possible duplicates start as Use existing (the owner's choice); Keep both is the other option.
  await expect(panel.getByRole("combobox", { name: "What to do with Jake Cruz" }).locator("option:checked")).toHaveText("Use existing Jake Cruz (1945 – 2022)");
  await expect(panel.getByRole("combobox", { name: "What to do with Taylor Humes" }).locator("option:checked")).toHaveText("Use existing Taylor Humes (1955)");
  await page.screenshot({ path: "test-results/screenshots/import-preview.png" });
  await panel.getByRole("button", { name: "Import" }).click();

  await expect(page.getByRole("tab", { name: "Jake Cruz's family" })).toHaveAttribute("aria-selected", "true");
  await expect(card(page, "Mia Cruz")).toBeVisible();
  await page.getByRole("tab", { name: "Cruz family" }).click();
  await expect(cards(page)).toHaveCount(37); // Mia, as Jake and Taylor's child, and no second Jake or Taylor
  await expect(card(page, "Jake Cruz")).toHaveCount(1);
});

test("a Viewer can save a picture of the sheet but can't export or import data", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId, cruzSheet } = await openSampleGroup(page, signIn, sampleGroup);
  const viewerPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    const viewer = await signIn(viewerPage, "Vera Viewer");
    await addMember(groupId, viewer, "view");
    await viewerPage.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cards(viewerPage)).toHaveCount(36);
    await expect(viewerPage.getByRole("button", { name: "Import…" })).toHaveCount(0);

    await viewerPage.getByRole("button", { name: "Export" }).click();
    const menu = viewerPage.getByRole("menu", { name: "Export" });
    await expect(menu.getByRole("menuitem")).toHaveText(["Picture (PNG)", "Print or save as PDF"]);
    const download = viewerPage.waitForEvent("download");
    await menu.getByRole("menuitem", { name: "Picture (PNG)" }).click();
    const saved = await download;
    await saved.saveAs("test-results/screenshots/sheet-picture.png"); // for checking by eye
    const png = await readFile(await saved.path());
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    expect(width).toBeGreaterThan(2000); // the whole sheet at twice the resolution, not the visible part
    expect(height).toBeGreaterThan(1000);

    const refused = await viewerPage.request.get(`/api/groups/${groupId}/export?format=json`);
    expect(refused.status()).toBe(404);
    expect(await refused.json()).toEqual({ error: "You don't have access to this family tree." });
  } finally {
    await viewerPage.context().close();
  }
});
