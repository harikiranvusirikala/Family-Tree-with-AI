import type { Page } from "@playwright/test";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

test.use({ viewport: { width: 1600, height: 1000 } });

const cards = (page: Page) => page.getByTestId("person-card");
/** A card's button on the canvas (not a link in the panel): its name is "Jake Cruz, 1945 – 2022". */
const card = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("button", { name: new RegExp(`^${name}(,|$)`) });
const personPanel = (page: Page) => page.getByRole("complementary", { name: "Person details" });
const form = (page: Page, name: string) => page.getByRole("form", { name });

/** Signs in a new owner of a group holding the sample family, on its "Cruz family" sheet. */
async function openSampleGroup(page: Page, signIn: SignIn, sampleGroup: SampleGroup) {
  const owner = await signIn(page, "Carla Cruz");
  const group = await sampleGroup(owner);
  await page.goto(`/g/${group.groupId}/s/${group.cruzSheet}`);
  await expect(cards(page)).toHaveCount(36);
  return group;
}

test("a child added under Jake and Taylor appears on every sheet that reaches them", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  await card(page, "Jake Cruz").click();
  await personPanel(page).getByRole("button", { name: "Add child" }).click();

  const add = form(page, "Add child");
  await expect(add.getByRole("combobox", { name: "Other parent" }).locator("option:checked")).toHaveText("with Taylor Humes");
  await add.getByRole("textbox", { name: "Name" }).fill("Baby Cruz");
  await add.getByRole("radio", { name: "Female", exact: true }).check();
  await add.getByRole("spinbutton", { name: "Birth year" }).fill("1990");
  await add.getByRole("button", { name: "Add child" }).click();

  await expect(cards(page)).toHaveCount(37); // laid out again, no reload
  await expect(card(page, "Baby Cruz")).toBeVisible();
  await page.getByRole("tab", { name: "Jerry Willow's family" }).click();
  await expect(cards(page)).toHaveCount(33);
  await expect(card(page, "Baby Cruz")).toBeVisible();
});

test("a partner who married in gets their own sheet, rooted at them", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  await card(page, "Amelia Young").click();
  await personPanel(page).getByRole("button", { name: "Add partner" }).click();

  const add = form(page, "Add partner");
  await expect(add.getByRole("checkbox", { name: /Create their own sheet/ })).toBeChecked();
  await expect(add.getByRole("radio", { name: "Male", exact: true })).toBeChecked(); // the opposite of Amelia's
  await add.getByRole("textbox", { name: "Name" }).fill("Rohan Mehta");
  await add.getByRole("spinbutton", { name: "Birth year" }).fill("1999");
  await add.getByRole("button", { name: "Add partner" }).click();

  await expect(page.getByRole("tab", { name: "Rohan Mehta's family" })).toBeVisible();
  await expect(cards(page)).toHaveCount(37);
  await page.getByRole("tab", { name: "Rohan Mehta's family" }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(card(page, "Rohan Mehta")).toBeVisible();
  await expect(card(page, "Amelia Young")).toBeVisible();
});

test("edit details, delete with Undo, and a sheet's root can't be deleted", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);

  await card(page, "Taylor Humes").click();
  await personPanel(page).getByRole("button", { name: "Edit details" }).click();
  await form(page, "Edit details").getByRole("spinbutton", { name: "Death year" }).fill("2024");
  await form(page, "Edit details").getByRole("button", { name: "Save" }).click();
  await expect(card(page, "Taylor Humes")).toHaveAccessibleName("Taylor Humes, 1955 – 2024");

  await card(page, "Alex Cruz").click();
  await personPanel(page).getByRole("button", { name: "Delete" }).click();
  await expect(cards(page)).toHaveCount(35);
  await expect(page.getByRole("status").filter({ hasText: "Alex Cruz deleted." })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(cards(page)).toHaveCount(36);
  await expect(card(page, "Alex Cruz")).toBeVisible();

  await card(page, "Alexander Cruz").click();
  await personPanel(page).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Alexander Cruz is the root of the sheet Cruz family." })).toBeVisible();
  await expect(cards(page)).toHaveCount(36);
});

test("add parents, delete both, and add parents again; then replace one (found in the owner's check)", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  const timothy = page.getByRole("tabpanel").getByRole("button", { name: "Timothy Cruz, 1880 – 1962", exact: true });
  async function addParents(father: string, mother: string) {
    await timothy.click();
    await personPanel(page).getByRole("button", { name: "Add parents" }).click();
    const add = form(page, "Add parents");
    await add.getByRole("textbox", { name: "Father's name" }).fill(father);
    await add.getByRole("textbox", { name: "Mother's name" }).fill(mother);
    await add.getByRole("button", { name: "Add parents" }).click();
  }
  async function remove(name: string) {
    await card(page, name).click();
    await personPanel(page).getByRole("button", { name: "Delete" }).click();
    await expect(card(page, name)).toHaveCount(0);
  }

  await addParents("John Cruz", "Mary Cruz");
  await expect(cards(page)).toHaveCount(38);
  await remove("John Cruz");
  await remove("Mary Cruz");
  await expect(cards(page)).toHaveCount(36);

  await addParents("Joseph Cruz", "Ruth Cruz");
  await expect(cards(page)).toHaveCount(38);
  await expect(card(page, "Joseph Cruz")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "already has parents" })).toHaveCount(0);

  // With one parent left, "Add the other parent" fills the deleted one's place.
  await remove("Joseph Cruz");
  await timothy.click();
  await personPanel(page).getByRole("button", { name: "Add the other parent" }).click();
  await form(page, "Add parents").getByRole("textbox", { name: "Name" }).fill("Peter Cruz");
  await form(page, "Add parents").getByRole("button", { name: "Add parent" }).click();
  await expect(cards(page)).toHaveCount(38);
  await expect(card(page, "Peter Cruz")).toBeVisible();
});

test("a couple marked divorced shows a broken heart", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  await page.getByRole("button", { name: "Steve Cruz and Arham Chopra, married" }).click();
  const couple = page.getByRole("complementary", { name: "Couple details" });
  await couple.getByRole("button", { name: "Divorced" }).click();
  await expect(page.getByRole("button", { name: "Steve Cruz and Arham Chopra, divorced" })).toBeVisible();
  await expect(couple.getByRole("button", { name: "Divorced" })).toHaveAttribute("aria-pressed", "true");
});

test("new sheet, pin and move a tab; the order is still there after a reload", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  await page.getByRole("button", { name: "+ New sheet" }).click();
  const create = form(page, "New sheet");
  await create.getByRole("combobox", { name: "Person" }).selectOption({ label: "Emma Young (1950)" });
  await expect(create.getByRole("textbox", { name: "Title" })).toHaveValue("Emma Young's family");
  await create.getByRole("button", { name: "Create sheet" }).click();

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveText(["Cruz family", "Jerry Willow's family", "Emma Young's family"]);
  await expect(page.getByRole("tab", { name: "Emma Young's family" })).toHaveAttribute("aria-selected", "true");

  // Unpinned tabs stay after the pinned ones, so it can't move left until it's pinned.
  await page.getByRole("button", { name: "Sheet options" }).click();
  await expect(page.getByRole("menuitem", { name: "Move left" })).toBeDisabled();
  await page.getByRole("menuitem", { name: "Pin" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: "Sheet options" }).click();
  await expect(page.getByRole("menuitem", { name: "Move left" })).toBeEnabled(); // once the pin is saved
  await page.getByRole("menuitem", { name: "Move left" }).click();
  await expect(tabs).toHaveText(["Cruz family", "Emma Young's family", "Jerry Willow's family"]);

  await page.reload();
  await expect(tabs).toHaveText(["Cruz family", "Emma Young's family", "Jerry Willow's family"]);
});

test("a Viewer sees the tree but no edit controls", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId, cruzSheet } = await openSampleGroup(page, signIn, sampleGroup);
  const viewerPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    const viewer = await signIn(viewerPage, "Vera Viewer");
    await addMember(groupId, viewer, "view");
    await viewerPage.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cards(viewerPage)).toHaveCount(36);
    await expect(viewerPage.getByRole("button", { name: "+ New sheet" })).toHaveCount(0);
    await expect(viewerPage.getByRole("button", { name: "Sheet options" })).toHaveCount(0);

    await card(viewerPage, "Jake Cruz").click();
    const panel = personPanel(viewerPage);
    await expect(panel.getByText("Taylor Humes")).toBeVisible();
    for (const action of ["Edit details", "Add partner", "Add child", "Delete"]) {
      await expect(panel.getByRole("button", { name: action })).toHaveCount(0);
    }
  } finally {
    await viewerPage.context().close();
  }
});
