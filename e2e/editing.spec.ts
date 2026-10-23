import type { Locator, Page } from "@playwright/test";
import type { Database } from "@/server/db";
import { applyOperations } from "@/server/operations/apply";
import { loadGroupTree } from "@/server/repositories/family";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

test.use({ viewport: { width: 1600, height: 1000 } });

const cards = (page: Page) => page.getByTestId("person-card");
/** A card's button on the canvas (not a link in the panel): its name is "Jake Cruz, 1945 – 2022". */
const card = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("button", { name: new RegExp(`^${name}(,|$)`) });
const personPanel = (page: Page) => page.getByRole("complementary", { name: "Person details" });
const form = (page: Page, name: string) => page.getByRole("form", { name });

/** Seven more sheets with long titles, like the owner's family: nine tabs, wider than the row. Their ids. */
async function addManySheets(database: Database, groupId: string, actor: string) {
  const tree = await loadGroupTree(database.db, groupId);
  const roots = ["Taylor Humes", "Olivia Cruz", "Arjun Patel", "Emma Young", "Margaret Yap", "Cynthia Willow", "Christina Cruz"];
  const ops = roots.map((name, i) => ({
    op: "createSheet",
    tempId: `new:sheet-${i}`,
    title: `${name} Venkata Lakshmi's family`,
    rootPersonId: tree.persons.find((p) => p.name === name)!.id,
  }));
  const { idMap } = await applyOperations(database, groupId, ops, actor);
  return roots.map((_, i) => idMap[`new:sheet-${i}`]);
}

/** The element is the topmost thing at its centre: nothing covers it. */
async function onScreen(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!top && (top === element || element.contains(top));
  });
}

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

test("a person's panel goes to their own sheet (owner request)", async ({ page, signIn, sampleGroup }) => {
  const { cruzSheet, jerrySheet } = await openSampleGroup(page, signIn, sampleGroup);
  const goTo = personPanel(page).getByRole("button", { name: /^Go to / });
  await card(page, "Jake Cruz").click();
  await expect(personPanel(page).getByRole("heading", { name: "Jake Cruz" })).toBeVisible();
  await expect(goTo).toHaveCount(0); // no sheet of his own

  await card(page, "Jerry Willow").click();
  await expect(goTo).toHaveText(["Go to Jerry Willow's family"]);
  await goTo.click();
  await expect(page).toHaveURL(new RegExp(`/s/${jerrySheet}$`));
  await expect(page.getByRole("tab", { name: "Jerry Willow's family" })).toHaveAttribute("aria-selected", "true");
  await expect(cards(page)).toHaveCount(32);
  // Still open on him, and his sheet is the one shown, so there's nowhere to go.
  await expect(personPanel(page).getByRole("heading", { name: "Jerry Willow" })).toBeVisible();
  await expect(goTo).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
  await expect(cards(page)).toHaveCount(36);
  await expect(goTo).toHaveText(["Go to Jerry Willow's family"]);
});

test("someone added without a sheet gets one later: Taylor Humes's leaves out her children with Jake (owner request)", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  await card(page, "Taylor Humes").click();
  await personPanel(page).getByRole("button", { name: "Create their own sheet" }).click();
  const create = form(page, "Create their own sheet");
  await expect(create.getByRole("textbox", { name: "Sheet title" })).toHaveValue("Taylor Humes's family");
  await expect(create.getByRole("radio", { name: "Leave out her children with Jake Cruz" })).toBeChecked();
  await create.getByRole("button", { name: "Create sheet" }).click();

  await expect(page.getByRole("tab", { name: "Taylor Humes's family" })).toBeVisible();
  await expect(personPanel(page).getByRole("button", { name: "Create their own sheet" })).toHaveCount(0); // she has one now
  await personPanel(page).getByRole("button", { name: "Go to Taylor Humes's family" }).click();
  await expect(page.getByRole("tab", { name: "Taylor Humes's family" })).toHaveAttribute("aria-selected", "true");
  await expect(cards(page)).toHaveCount(2); // Taylor and Jake: their children are on the Cruz side
  await expect(card(page, "Jake Cruz")).toBeVisible();
});

test("adding parents, the mother gets her own sheet, showing her side (owner requests)", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  await card(page, "Taylor Humes").click();
  await personPanel(page).getByRole("button", { name: "Add parents" }).click();
  const add = form(page, "Add parents");
  const ownSheet = add.getByRole("checkbox", { name: /Create their own sheet/ });
  await expect(ownSheet).toBeChecked(); // like a partner's, since her side moved there (owner request after the full dates)
  await add.getByRole("textbox", { name: "Father's name" }).fill("Frank Humes");
  await add.getByRole("textbox", { name: "Mother's name" }).fill("Grace Lee");
  await add.getByRole("button", { name: "Add parents" }).click();
  await expect(page.getByRole("tab", { name: "Grace Lee's family" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Frank Humes's family" })).toHaveCount(0);
  await expect(cards(page)).toHaveCount(36); // a partner's parents belong on their own sheets (§6)
  await page.getByRole("tab", { name: "Grace Lee's family" }).click();
  await expect(cards(page)).toHaveCount(2); // her side only: her children are on the father's side
  for (const name of ["Grace Lee", "Frank Humes"]) await expect(card(page, name)).toBeVisible();
  await expect(card(page, "Taylor Humes")).toHaveCount(0);

  // "Add the other parent" offers it only when that parent is the mother. With only a father, the
  // checked box is left alone: no mother, no sheet.
  await page.getByRole("tab", { name: "Cruz family" }).click();
  await card(page, "Arham Chopra").click();
  await personPanel(page).getByRole("button", { name: "Add parents" }).click();
  await expect(ownSheet).toBeChecked();
  await add.getByRole("textbox", { name: "Father's name" }).fill("Dev Chopra");
  await add.getByRole("button", { name: "Add parents" }).click();
  await expect(personPanel(page).getByRole("button", { name: "Add the other parent" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Dev Chopra's family" })).toHaveCount(0);
  await personPanel(page).getByRole("button", { name: "Add the other parent" }).click();
  await expect(add.getByRole("radio", { name: "Female", exact: true })).toBeChecked();
  await expect(ownSheet).toBeChecked();
  await add.getByRole("radio", { name: "Male", exact: true }).check();
  await expect(ownSheet).toHaveCount(0);
  await add.getByRole("radio", { name: "Female", exact: true }).check();
  await add.getByRole("textbox", { name: "Name" }).fill("Meera Chopra");
  await add.getByRole("button", { name: "Add parent" }).click();
  await expect(page.getByRole("tab", { name: "Meera Chopra's family" })).toBeVisible();
});

test("a mother's own sheet holds her side: her parents go there, not on her son's sheet (owner request)", async ({ page, signIn, sampleGroup }) => {
  const { cruzSheet } = await openSampleGroup(page, signIn, sampleGroup);
  const tabpanel = page.getByRole("tabpanel");
  // Timothy Cruz (1880), at the top of the Cruz family, gets parents; his mother gets her own sheet.
  await tabpanel.getByRole("button", { name: "Timothy Cruz, 1880 – 1962", exact: true }).click();
  await personPanel(page).getByRole("button", { name: "Add parents" }).click();
  const add = form(page, "Add parents");
  await expect(add.getByText(/not on this sheet/)).toHaveCount(0); // they show here
  await add.getByRole("textbox", { name: "Father's name" }).fill("Henry Cruz");
  await add.getByRole("textbox", { name: "Mother's name" }).fill("Rose Bell");
  await add.getByRole("button", { name: "Add parents" }).click();
  await expect(page.getByRole("tab", { name: "Rose Bell's family" })).toBeVisible();
  await expect(cards(page)).toHaveCount(38);

  // Her parents, added from the Cruz family sheet, go on hers, which opens.
  await card(page, "Rose Bell").click();
  await personPanel(page).getByRole("button", { name: "Add parents" }).click();
  await expect(add.getByText("They'll be on Rose Bell's family, not on this sheet. Saving opens it.")).toBeVisible();
  await add.getByRole("textbox", { name: "Father's name" }).fill("Walter Bell");
  await add.getByRole("textbox", { name: "Mother's name" }).fill("Ida Bell");
  await add.getByRole("button", { name: "Add parents" }).click();
  await expect(page.getByRole("tab", { name: "Rose Bell's family" })).toHaveAttribute("aria-selected", "true");
  await expect(personPanel(page).getByRole("heading", { name: "Rose Bell" })).toBeVisible();
  for (const name of ["Rose Bell", "Henry Cruz", "Walter Bell", "Ida Bell"]) await expect(card(page, name)).toBeVisible();
  await expect(cards(page)).toHaveCount(4); // her side, her partner; not their son's family
  await expect(page.getByRole("tab", { name: "Ida Bell's family" })).toBeVisible(); // the box starts checked

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
  await expect(cards(page)).toHaveCount(38); // Rose, but not her parents
  await expect(card(page, "Rose Bell")).toBeVisible();
  await expect(card(page, "Walter Bell")).toHaveCount(0);
  await expect(card(page, "Ida Bell")).toHaveCount(0);
});

test("a renamed person's sheet follows; a partner's sheet is deleted, then the partner (owner request)", async ({ page, signIn, sampleGroup }) => {
  const { cruzSheet } = await openSampleGroup(page, signIn, sampleGroup);
  await card(page, "Jerry Willow").click();
  await personPanel(page).getByRole("button", { name: "Edit details" }).click();
  await form(page, "Edit details").getByRole("textbox", { name: "Name" }).fill("Jerry Willow-Cruz");
  await form(page, "Edit details").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("tab", { name: "Jerry Willow-Cruz's family" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Jerry Willow's family" })).toHaveCount(0);
  await personPanel(page).getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "Jerry Willow-Cruz's family" }).click();
  const options = page.getByRole("button", { name: "Sheet options" });
  const menu = page.getByRole("menu", { name: "Sheet options" });
  await options.click();
  await menu.getByRole("menuitem", { name: "Delete sheet" }).click();
  await expect(form(page, "Delete sheet")).toContainText("Jerry Willow-Cruz's family is pinned, like the father's and mother's sheets, so it can't be deleted. Unpin it first.");
  await form(page, "Delete sheet").getByRole("button", { name: "Close" }).click();
  await options.click();
  await menu.getByRole("menuitem", { name: "Unpin" }).click();
  await options.click();
  await expect(menu.getByRole("menuitem", { name: "Pin", exact: true })).toBeVisible(); // saved
  await menu.getByRole("menuitem", { name: "Delete sheet" }).click();
  await expect(form(page, "Delete sheet")).toContainText("Delete the sheet Jerry Willow-Cruz's family? Everyone on it stays in the family.");
  await form(page, "Delete sheet").getByRole("button", { name: "Delete sheet" }).click();

  await expect(page.getByRole("tab", { name: "Jerry Willow-Cruz's family" })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
  await expect(page.getByRole("tab", { name: "Cruz family" })).toHaveAttribute("aria-selected", "true");
  await expect(cards(page)).toHaveCount(36); // nobody was deleted with the sheet

  await card(page, "Jerry Willow-Cruz").click();
  await personPanel(page).getByRole("button", { name: "Delete" }).click();
  await expect(cards(page)).toHaveCount(35);
});

test("edit details, delete with Undo, and a sheet's root can't be deleted", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);

  await card(page, "Taylor Humes").click();
  await personPanel(page).getByRole("button", { name: "Edit details" }).click();
  await expect(form(page, "Edit details").getByRole("spinbutton", { name: "Death year" })).toHaveCount(0); // living: no death fields until checked
  await form(page, "Edit details").getByRole("checkbox", { name: "Has died" }).check();
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
    await add.getByRole("checkbox", { name: /Create their own sheet/ }).uncheck(); // a sheet's root can't be deleted
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
  await page.getByRole("button", { name: "New sheet", exact: true }).click();
  const create = form(page, "New sheet");
  await expect(create.getByRole("combobox", { name: "Person" })).toBeFocused(); // in a dialog (the production look)
  await create.getByRole("combobox", { name: "Person" }).selectOption({ label: "Emma Young (1950)" });
  await expect(create.getByRole("textbox", { name: "Title" })).toHaveValue("Emma Young's family");
  await page.screenshot({ path: "test-results/screenshots/new-sheet-dialog.png", animations: "disabled" });
  await create.getByRole("button", { name: "Create sheet" }).click();

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveText(["★ Everyone", "Cruz family", "Jerry Willow's family", "Emma Young's family"]);
  await expect(page.getByRole("tab", { name: "Emma Young's family" })).toHaveAttribute("aria-selected", "true");

  // Unpinned tabs stay after the pinned ones, so it can't move left until it's pinned.
  await page.getByRole("button", { name: "Sheet options" }).click();
  await expect(page.getByRole("menuitem", { name: "Move left" })).toBeDisabled();
  await page.screenshot({ path: "test-results/screenshots/sheet-options.png", animations: "disabled" });
  await page.getByRole("menuitem", { name: "Pin" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: "Sheet options" }).click();
  await expect(page.getByRole("menuitem", { name: "Move left" })).toBeEnabled(); // once the pin is saved
  await page.getByRole("menuitem", { name: "Move left" }).click();
  await expect(tabs).toHaveText(["★ Everyone", "Cruz family", "Emma Young's family", "Jerry Willow's family"]);

  await page.reload();
  await expect(tabs).toHaveText(["★ Everyone", "Cruz family", "Emma Young's family", "Jerry Willow's family"]);
});

test("with many sheets, New sheet never covers the last tabs (found by the owner)", async ({ page, signIn, sampleGroup, database }) => {
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  await addManySheets(database, groupId, owner.id);

  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(10); // ★ Everyone and nine sheets
  // On a computer the sheet options (⋯) come first, before the pinned tabs (the owner's choice).
  const options = (await page.getByRole("button", { name: "Sheet options" }).boundingBox())!;
  expect(options.x + options.width).toBeLessThanOrEqual((await tabs.first().boundingBox())!.x);
  const newSheet = (await page.getByRole("button", { name: "New sheet", exact: true }).boundingBox())!;
  for (const tab of await tabs.all()) {
    const box = (await tab.boundingBox())!;
    expect(box.x + box.width, await tab.textContent() ?? "").toBeLessThanOrEqual(newSheet.x);
  }
  // The last tab, scrolled into view, is what a click there reaches, and it opens.
  const last = tabs.last();
  await last.scrollIntoViewIfNeeded();
  expect(await onScreen(last)).toBe(true);
  await last.click();
  await expect(last).toHaveAttribute("aria-selected", "true");
});

test("the sheet tabs scroll without a scrollbar: a mouse wheel scrolls them, and the open sheet's tab comes into view (owner request)", async ({ page, signIn, sampleGroup, database }) => {
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  const sheets = await addManySheets(database, groupId, owner.id);
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(10); // ★ Everyone and nine sheets

  // Wider than the row, and no scrollbar under the names.
  const row = page.getByRole("tablist").locator("..");
  expect(await row.evaluate((el: HTMLElement) => ({ overflows: el.scrollWidth > el.clientWidth, scrollbar: el.offsetHeight - el.clientHeight, style: getComputedStyle(el).scrollbarWidth }))).toEqual({
    overflows: true,
    scrollbar: 0,
    style: "none",
  });

  // A mouse wheel scrolls it sideways.
  const rowBox = (await row.boundingBox())!;
  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await onScreen(page.getByRole("button", { name: "Sheet options" }))).toBe(true); // ⋯ stays at the start

  // Opening the last sheet brings its tab into view.
  await page.goto(`/g/${groupId}/s/${sheets.at(-1)}`);
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  await expect.poll(async () => {
    const tab = (await tabs.last().boundingBox())!;
    return tab.x >= rowBox.x && tab.x + tab.width <= rowBox.x + rowBox.width;
  }).toBe(true);
});

test("a Viewer sees the tree but no edit controls", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId, cruzSheet } = await openSampleGroup(page, signIn, sampleGroup);
  const viewerPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    const viewer = await signIn(viewerPage, "Vera Viewer");
    await addMember(groupId, viewer, "view");
    await viewerPage.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cards(viewerPage)).toHaveCount(36);
    await expect(viewerPage.getByRole("button", { name: "New sheet", exact: true })).toHaveCount(0);
    await expect(viewerPage.getByRole("button", { name: "Sheet options" })).toHaveCount(0);

    await card(viewerPage, "Jake Cruz").click();
    const panel = personPanel(viewerPage);
    await expect(panel.getByText("Taylor Humes")).toBeVisible();
    for (const action of ["Edit details", "Add partner", "Add child", "Delete"]) {
      await expect(panel.getByRole("button", { name: action })).toHaveCount(0);
    }

    // Going to someone's sheet isn't an edit.
    await card(viewerPage, "Jerry Willow").click();
    await panel.getByRole("button", { name: "Go to Jerry Willow's family" }).click();
    await expect(viewerPage.getByRole("tab", { name: "Jerry Willow's family" })).toHaveAttribute("aria-selected", "true");
    await expect(cards(viewerPage)).toHaveCount(32);
  } finally {
    await viewerPage.context().close();
  }
});

test("a marriage date: the year above the heart, the full date while the heart or a partner is selected; added and cleared from the heart (owner request)", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  /** The date above a couple's heart. */
  const dateOf = (couple: string) => page.locator(".react-flow__node-union").filter({ has: page.getByRole("button", { name: `${couple}, married` }) }).getByTestId("marriage-date");

  // The sample's own: Steve and Arham married on 8 Sep 2008.
  await expect(dateOf("Steve Cruz and Arham Chopra")).toHaveText("2008");
  await card(page, "Arham Chopra").click();
  await expect(dateOf("Steve Cruz and Arham Chopra")).toHaveText("8 Sep 2008");
  await expect(personPanel(page).getByRole("button", { name: /^Steve Cruz/ })).toContainText("Married 8 Sep 2008"); // his row, under Partner
  await personPanel(page).getByRole("button", { name: "Close" }).click();
  await expect(dateOf("Steve Cruz and Arham Chopra")).toHaveText("2008");

  // Marvin and Jazmine have none until it's added from their heart.
  await expect(dateOf("Marvin Young and Jazmine Brooke")).toHaveCount(0);
  await page.getByRole("button", { name: "Marvin Young and Jazmine Brooke, married" }).click();
  const couple = page.getByRole("complementary", { name: "Couple details" });
  await expect(couple).toContainText("Not added");
  await couple.getByRole("button", { name: "Add marriage date" }).click();
  const date = form(page, "Marriage date");
  await date.getByRole("spinbutton", { name: "Marriage day" }).fill("4");
  await date.getByRole("combobox", { name: "Marriage month" }).selectOption({ label: "Jul" });
  await date.getByRole("spinbutton", { name: "Marriage year" }).fill("1999");
  await date.getByRole("button", { name: "Save" }).click();
  await expect(couple).toContainText("4 Jul 1999");
  await expect(dateOf("Marvin Young and Jazmine Brooke")).toHaveText("4 Jul 1999"); // the heart is selected
  await couple.getByRole("button", { name: "Close" }).click();
  await expect(dateOf("Marvin Young and Jazmine Brooke")).toHaveText("1999");
  await card(page, "Jazmine Brooke").click();
  await expect(dateOf("Marvin Young and Jazmine Brooke")).toHaveText("4 Jul 1999");
  await expect(personPanel(page).getByRole("button", { name: /^Marvin Young/ })).toContainText("Married 4 Jul 1999");
  await page.screenshot({ path: "test-results/screenshots/marriage-date.png" });

  // Emptying the fields removes it.
  await page.getByRole("button", { name: "Marvin Young and Jazmine Brooke, married" }).click();
  await couple.getByRole("button", { name: "Change marriage date" }).click();
  await date.getByRole("spinbutton", { name: "Marriage day" }).fill("");
  await date.getByRole("combobox", { name: "Marriage month" }).selectOption({ label: "–" });
  await date.getByRole("spinbutton", { name: "Marriage year" }).fill("");
  await date.getByRole("button", { name: "Save" }).click();
  await expect(couple).toContainText("Not added");
  await expect(dateOf("Marvin Young and Jazmine Brooke")).toHaveCount(0);
});

test("a full birth date: the card shows the year, and the full date while selected; the panel too; clearing it keeps the year (owner request)", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  const steve = cards(page).filter({ has: page.getByRole("button", { name: "Steve Cruz, 1985" }) });

  await card(page, "Steve Cruz").click();
  await personPanel(page).getByRole("button", { name: "Edit details" }).click();
  const edit = form(page, "Edit details");
  await expect(edit.getByRole("checkbox", { name: "Has died" })).not.toBeChecked();
  await edit.getByRole("spinbutton", { name: "Birth day" }).fill("12");
  await edit.getByRole("combobox", { name: "Birth month" }).selectOption({ label: "Mar" });
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(personPanel(page).getByText("12 Mar 1985", { exact: true })).toBeVisible();
  await expect(steve).toContainText("12 Mar 1985"); // selected: the full date
  await expect(card(page, "Steve Cruz")).toHaveAccessibleName("Steve Cruz, 1985");

  await personPanel(page).getByRole("button", { name: "Close" }).click();
  await expect(steve).not.toContainText("12 Mar"); // not selected: the year only
  await expect(steve).toContainText("1985");

  // A date that doesn't exist is refused in the form, before saving.
  await card(page, "Steve Cruz").click();
  await personPanel(page).getByRole("button", { name: "Edit details" }).click();
  await edit.getByRole("spinbutton", { name: "Birth day" }).fill("31");
  await edit.getByRole("combobox", { name: "Birth month" }).selectOption({ label: "Feb" });
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(personPanel(page).getByRole("alert")).toHaveText("31 Feb 1985 isn't a real date.");

  // Clearing the day and month keeps the year.
  await edit.getByRole("spinbutton", { name: "Birth day" }).fill("");
  await edit.getByRole("combobox", { name: "Birth month" }).selectOption({ label: "–" });
  await edit.getByRole("button", { name: "Save" }).click();
  // Under his name (his relatives' rows have years too: Sammie Chang's is 1985).
  await expect(personPanel(page).getByRole("heading", { name: "Steve Cruz" }).locator("..").getByText("1985", { exact: true })).toBeVisible();
  await expect(steve).not.toContainText("Mar");
});
