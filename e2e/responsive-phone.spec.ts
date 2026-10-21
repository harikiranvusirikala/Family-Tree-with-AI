import type { Locator, Page } from "@playwright/test";
import { INVALID_INVITE } from "@/server/repositories/invites";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

// Phones (an owner request after the final check). The "phone" project runs this file in Chrome's
// iPhone 13 emulation: 390 × 844, touch, a mobile viewport.

const cards = (page: Page) => page.getByTestId("person-card");
const card = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("button", { name: new RegExp(`^${name}(,|$)`) });
const cardBox = (page: Page, name: string) => cards(page).filter({ hasText: name });
const personPanel = (page: Page) => page.getByRole("complementary", { name: "Person details" });
const picker = (page: Page) => page.getByRole("combobox", { name: "Sheet" });
const sheetMenu = (page: Page) => page.getByRole("menu", { name: "Sheet menu" });
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screenshots/${name}.png` });

/** Nothing sticks out sideways: the page can't be scrolled left and right. */
async function fitsWidth(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), page.url()).toBeLessThanOrEqual(0);
}

/** The element is the topmost thing at its centre: not covered, and on the screen. */
async function onScreen(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!top && (top === element || element.contains(top));
  });
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("not drawn");
  return b;
}

/** Signs in a new owner of a group holding the sample family, on its "Cruz family" sheet. */
async function openSampleGroup(page: Page, signIn: SignIn, sampleGroup: SampleGroup) {
  const owner = await signIn(page, "Carla Cruz");
  const group = await sampleGroup(owner);
  await page.goto(`/g/${group.groupId}/s/${group.cruzSheet}`);
  await expect(cards(page)).toHaveCount(36);
  return { owner, ...group };
}

test("every page fits a phone's width, at 390 and 360 px", async ({ page, signIn, sampleGroup }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Family Tree" })).toBeVisible();
  await fitsWidth(page);

  const { groupId, cruzSheet } = await openSampleGroup(page, signIn, sampleGroup);
  const pages: [string, string][] = [
    ["/dashboard", "Welcome, Carla Cruz"],
    [`/g/${groupId}/members`, "Members"],
    [`/g/${groupId}/settings`, "Group settings"],
    [`/g/0123456789abcdef01234567/s/${cruzSheet}`, "You don't have access to this family tree"],
    [`/invite/${"x".repeat(43)}`, INVALID_INVITE], // the invite page's layout, for a link that doesn't work
  ];
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 780 });
    for (const [path, heading] of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await fitsWidth(page);
    }
    await page.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cards(page)).toHaveCount(36);
    await fitsWidth(page);
    // The group's name has room: not cut down to "C." by the header's other items.
    const name = page.getByRole("banner").getByText("Cruz family", { exact: true });
    await expect(name).toBeVisible();
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
});

test("the header's menu holds Members, Settings, the theme and Sign out", async ({ page, signIn, sampleGroup }) => {
  const { owner } = await openSampleGroup(page, signIn, sampleGroup);
  const header = page.getByRole("banner");
  for (const name of ["Members", "Settings"]) await expect(header.getByRole("link", { name })).toHaveCount(0);
  await expect(header.getByRole("group", { name: "Theme" })).toHaveCount(0);

  await header.getByRole("button", { name: owner.name }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Members" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await menu.getByRole("button", { name: "Night theme" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await menu.getByRole("button", { name: "Day theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await menu.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Group settings" })).toBeVisible();
});

test("a sheet opens zoomed in at its root, and the picker switches sheets", async ({ page, signIn, sampleGroup }) => {
  const { cruzSheet, jerrySheet } = await openSampleGroup(page, signIn, sampleGroup);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(picker(page)).toHaveValue(cruzSheet);
  await expect(picker(page).locator("option")).toHaveText(["★ Everyone", "Cruz family", "Jerry Willow's family"]);

  // The root, Alexander Cruz: centred across, on screen, and large enough to read (cards are 150 px).
  const viewport = page.viewportSize()!;
  await expect.poll(async () => (await box(cardBox(page, "Alexander Cruz"))).width).toBeGreaterThan(105);
  const root = await box(cardBox(page, "Alexander Cruz"));
  expect(Math.abs(root.x + root.width / 2 - viewport.width / 2)).toBeLessThan(4);
  expect(root.y).toBeGreaterThan(0);
  expect(root.y + root.height).toBeLessThan(viewport.height);
  await shot(page, "phone-tree");

  await picker(page).selectOption({ label: "Jerry Willow's family" });
  await expect(page).toHaveURL(new RegExp(`/s/${jerrySheet}$`));
  await expect(cards(page)).toHaveCount(32);
});

test("the eye stays in the row before the sheet menu, which holds the sheet's options and the other tools", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  for (const name of ["Export", "Import…", "Sheet options", "+ New sheet"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);

  // The eye that hides photos: in the row, just before the menu (the owner's choice after the preview).
  const eye = page.getByRole("button", { name: "Hide photos" });
  const [eyeBox, menuButton] = [await box(eye), await box(page.getByRole("button", { name: "Sheet menu" }))];
  expect(eyeBox.x + eyeBox.width).toBeLessThanOrEqual(menuButton.x);
  expect(Math.abs(eyeBox.y + eyeBox.height / 2 - (menuButton.y + menuButton.height / 2))).toBeLessThan(2);
  // A bigger eye than on a computer, with no circle around it (also the owner's choice).
  expect(await eye.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
  expect((await box(eye.locator("svg"))).width).toBe(24);
  await eye.tap();
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await eye.tap();
  await expect(eye).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Sheet menu" }).click();
  const menu = sheetMenu(page);
  for (const name of ["Rename", "Unpin", "Move up", "Delete sheet", "+ New sheet", "Picture (PNG)", "Data: whole group (JSON)", "Import…"]) {
    await expect(menu.getByRole("menuitem", { name, exact: true })).toBeVisible();
  }
  await expect(menu.getByText("Hide photos")).toHaveCount(0);
  await shot(page, "phone-menu");
  for (const item of await menu.getByRole("menuitem").all()) {
    await item.scrollIntoViewIfNeeded(); // the menu scrolls when it's taller than the screen
    expect(await onScreen(item)).toBe(true);
  }

  const download = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: "Picture (PNG)" }).click();
  await expect(menu).toHaveCount(0); // any item closes it
  expect((await download).suggestedFilename()).toBe("Cruz family.png");

  await page.getByRole("button", { name: "Sheet menu" }).click();
  await menu.getByRole("menuitem", { name: "Import…" }).click();
  const importPanel = page.getByRole("complementary", { name: "Import" });
  await expect(importPanel).toBeVisible();
  expect((await box(importPanel)).width).toBe(page.viewportSize()!.width);
  await importPanel.getByRole("button", { name: "Close" }).click();
  await expect(importPanel).toHaveCount(0);

  // A tap on the tree, below the menu, closes it.
  await page.getByRole("button", { name: "Sheet menu" }).click();
  await expect(menu).toBeVisible();
  const tree = await box(page.getByRole("tabpanel"));
  await page.getByRole("tabpanel").tap({ position: { x: tree.width / 2, y: tree.height - 40 } });
  await expect(menu).toHaveCount(0);
});

test("a person's panel opens over the bottom half, with their card above it", async ({ page, signIn, sampleGroup }) => {
  const { jerrySheet } = await openSampleGroup(page, signIn, sampleGroup);
  const viewport = page.viewportSize()!;

  // Olivia Cruz starts in the lower part of the screen, where the panel will be.
  await expect.poll(async () => (await box(cardBox(page, "Olivia Cruz"))).width).toBeGreaterThan(105);
  await card(page, "Olivia Cruz").tap();
  const panel = personPanel(page);
  await expect(panel.getByRole("heading", { name: "Olivia Cruz" })).toBeVisible();
  const panelBox = await box(panel);
  expect(panelBox.width).toBe(viewport.width);
  expect(panelBox.y).toBeGreaterThan(viewport.height * 0.4);
  /** The card is on screen, above the panel. */
  const inView = async (name: string) => {
    const b = await box(cardBox(page, name));
    return b.y > 0 && b.y + b.height <= panelBox.y && b.x >= 0 && b.x + b.width <= viewport.width;
  };
  await expect.poll(() => inView("Olivia Cruz")).toBe(true);
  await shot(page, "phone-panel");

  // Every button in it is big enough to tap.
  for (const name of ["Close", "Edit details", "Add child", "Delete"]) expect((await box(panel.getByRole("button", { name, exact: true }))).height, name).toBeGreaterThanOrEqual(44);

  // Her father, from the panel: his card, now above the screen, comes into view too.
  await panel.getByRole("button", { name: "Jerry Willow", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Jerry Willow" })).toBeVisible();
  await expect.poll(() => inView("Jerry Willow")).toBe(true);

  // A form uses the tree's whole height, and saves.
  await panel.getByRole("button", { name: "Add child" }).click();
  const add = page.getByRole("form", { name: "Add child" });
  expect((await box(panel)).y).toBeLessThan(viewport.height * 0.25);
  await add.getByRole("textbox", { name: "Name" }).fill("Baby Willow");
  await add.getByRole("radio", { name: "Female", exact: true }).check();
  await add.getByRole("button", { name: "Add child" }).click();
  await expect(cards(page)).toHaveCount(37);
  await expect(add).toHaveCount(0);

  await panel.getByRole("button", { name: "Go to Jerry Willow's family" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${jerrySheet}$`));
  await expect(picker(page)).toHaveValue(jerrySheet);
  await expect(cards(page)).toHaveCount(33);
});

test("Ask AI opens the chat over the tree, and Close comes back", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  const ask = page.getByRole("button", { name: "Ask AI" });
  expect(await onScreen(ask)).toBe(true);
  await ask.tap();
  const chat = page.getByRole("complementary", { name: "Family assistant" });
  await expect(chat).toBeVisible();
  expect((await box(chat)).width).toBe(page.viewportSize()!.width);
  await shot(page, "phone-chat");
  await chat.getByRole("button", { name: "Close" }).click();
  await expect(chat).toBeHidden();
  await expect(card(page, "Alexander Cruz")).toBeVisible();
});

test("the main controls are big enough to tap", async ({ page, signIn, sampleGroup }) => {
  const { owner } = await openSampleGroup(page, signIn, sampleGroup);
  const controls = [
    picker(page),
    page.getByRole("button", { name: "Sheet menu" }),
    page.getByRole("button", { name: "Ask AI" }),
    page.getByRole("button", { name: "Hide photos" }),
    page.getByRole("banner").getByRole("button", { name: owner.name }),
  ];
  for (const control of controls) expect((await box(control)).height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Sheet menu" }).click();
  for (const item of await sheetMenu(page).getByRole("menuitem").all()) expect((await box(item)).height).toBeGreaterThanOrEqual(44);
  // Text fields have 16 px text, so the phone doesn't zoom in when one is tapped.
  await sheetMenu(page).getByRole("menuitem", { name: "Rename" }).click();
  const title = page.getByRole("form", { name: "Rename sheet" }).getByRole("textbox", { name: "Sheet title" });
  expect(await title.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
});

test("a Viewer gets the eye, and a sheet menu with only the picture", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const { groupId, cruzSheet } = await openSampleGroup(page, signIn, sampleGroup);
  const viewerPage = await browser.newPage({ viewport: page.viewportSize()!, isMobile: true, hasTouch: true });
  try {
    const viewer = await signIn(viewerPage, "Vera Viewer");
    await addMember(groupId, viewer, "view");
    await viewerPage.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cards(viewerPage)).toHaveCount(36);
    await viewerPage.getByRole("button", { name: "Sheet menu" }).click();
    const menu = sheetMenu(viewerPage);
    await expect(menu.getByRole("menuitem", { name: "Picture (PNG)" })).toBeVisible();
    await expect(viewerPage.getByRole("button", { name: "Hide photos" })).toBeVisible();
    for (const name of ["Rename", "+ New sheet", "Import…", "Data: whole group (JSON)"]) await expect(menu.getByRole("menuitem", { name, exact: true })).toHaveCount(0);
  } finally {
    await viewerPage.context().close();
  }
});

test("night colours on a phone", async ({ page, signIn, sampleGroup }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openSampleGroup(page, signIn, sampleGroup);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await card(page, "Jerry Willow").tap();
  await expect(personPanel(page).getByRole("heading", { name: "Jerry Willow" })).toBeVisible();
  await shot(page, "night-phone-tree");
});

test("★ Everyone is the first choice in the sheet picker; a phone opens it on the List, and the Network, the Wheel and the Tree readable (owner request)", async ({ page, signIn, sampleGroup }) => {
  const { groupId } = await openSampleGroup(page, signIn, sampleGroup);
  await expect(picker(page).locator("option").first()).toHaveText("★ Everyone");
  await picker(page).selectOption({ label: "★ Everyone" });
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/s/everyone\\?view=list$`)); // a phone's first view
  const rows = page.getByRole("table", { name: "People" }).locator("tbody tr");
  await expect(rows).toHaveCount(36);
  await expect(page.getByRole("searchbox", { name: "Find someone" })).toBeVisible();
  // Only the person, with their relations in one line.
  const steve = rows.filter({ has: page.getByRole("button", { name: "Steve Cruz, 1985", exact: true }) });
  await expect(steve.getByRole("cell")).toHaveCount(1);
  await expect(steve.getByText("Child of Olivia & Arjun · ♥ Sammie (2001), Arham (2008) · 3 children")).toBeVisible();
  await fitsWidth(page);
  expect(await page.getByRole("table", { name: "People" }).evaluate((table) => table.scrollWidth - table.parentElement!.clientWidth)).toBeLessThanOrEqual(0);
  // Sorting by birth without column names (an owner request): the Sort choice.
  await page.getByRole("combobox", { name: "Sort" }).selectOption({ label: "Oldest first" });
  await expect(rows.first().getByRole("button").first()).toHaveAccessibleName("Timothy Cruz, 1880 – 1962");
  await page.getByRole("combobox", { name: "Sort" }).selectOption({ label: "A to Z" });
  await shot(page, "phone-everyone-list");

  // A row low on the screen opens the panel over the bottom, and moves up above it.
  const carrie = page.getByRole("button", { name: "Carrie Young, 2001", exact: true });
  await carrie.tap();
  await expect(personPanel(page).getByRole("heading", { name: "Carrie Young" })).toBeVisible();
  await expect.poll(async () => {
    const row = await box(rows.filter({ has: carrie }));
    return row.y > 0 && row.y + row.height <= (await box(personPanel(page))).y;
  }).toBe(true);
  await personPanel(page).getByRole("button", { name: "Close" }).tap();

  // The Network, readable.
  await expect(page.getByRole("group", { name: "View" }).getByRole("button")).toHaveText(["Tree", "Network", "Wheel", "List", "Upcoming"]);
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Network" }).tap();
  await expect(page).toHaveURL(new RegExp(`/s/everyone\\?view=network$`));
  const circles = page.getByRole("tabpanel").getByTestId("network-person");
  await expect(circles).toHaveCount(36);
  await expect.poll(async () => (await box(circles.filter({ hasText: "Alexander Cruz" }))).width).toBeGreaterThan(80);
  await fitsWidth(page);
  await shot(page, "phone-everyone-network");

  // The Wheel, readable at the closest ring, around the first sheet's root (nobody is selected).
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Wheel" }).tap();
  await expect(page).toHaveURL(/\/s\/everyone\?view=wheel&centre=[0-9a-f]{24}$/);
  const onWheel = page.getByRole("tabpanel").getByTestId("wheel-person");
  await expect(onWheel).toHaveCount(36);
  await expect.poll(async () => (await box(onWheel.filter({ hasText: "Jake Cruz" }))).width).toBeGreaterThan(85);
  await expect(onWheel.filter({ hasText: "Jake Cruz" }).getByTestId("relation")).toHaveText("Koduku");
  await fitsWidth(page);
  await shot(page, "phone-everyone-wheel");

  // The Tree, readable.
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Tree" }).tap();
  await expect(page).toHaveURL(new RegExp(`/s/everyone\\?view=tree$`));
  await expect(cards(page)).toHaveCount(36);
  await expect(page.getByRole("combobox", { name: "Find someone" })).toBeVisible();
  await expect.poll(async () => (await box(cardBox(page, "Alexander Cruz"))).width).toBeGreaterThan(105);
  await shot(page, "phone-everyone");

  // Upcoming (an owner request): the five views' names fit the phone, without their icons.
  const views = page.getByRole("group", { name: "View" });
  const viewsBox = await box(views);
  expect(viewsBox.x + viewsBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await views.getByRole("button").evaluateAll((buttons) => buttons.every((b) => b.scrollWidth <= b.clientWidth))).toBe(true);
  await views.getByRole("button", { name: "Upcoming" }).tap();
  await expect(page).toHaveURL(new RegExp(`/s/everyone\\?view=upcoming$`));
  await expect(page.getByTestId("upcoming-row")).toHaveText([/Steve Cruz & Arham Chopra\d+(st|nd|rd|th) anniversary$/]); // the sample's only full date
  await fitsWidth(page);
  await shot(page, "phone-everyone-upcoming");
});
