import type { Locator, Page } from "@playwright/test";
import { applyOperations } from "@/server/operations/apply";
import { loadGroupTree } from "@/server/repositories/family";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

// ★ Everyone (an owner request after the final check): part 1, the tab and the Tree view; part 2, the
// List and the view switcher; part 3, the Network; part 4, the Wheel.

test.use({ viewport: { width: 1600, height: 1000 } });

const cards = (page: Page) => page.getByRole("tabpanel").getByTestId("person-card");
const card = (page: Page, name: string) => cards(page).filter({ hasText: name });
const personPanel = (page: Page) => page.getByRole("complementary", { name: "Person details" });
const find = (page: Page) => page.getByRole("combobox", { name: "Find someone" });
const viewButton = (page: Page, name: "Tree" | "Network" | "Wheel" | "List") => page.getByRole("group", { name: "View" }).getByRole("button", { name });
const listRows = (page: Page) => page.getByRole("table", { name: "People" }).locator("tbody tr");
const listRow = (page: Page, nameAndYears: string) => listRows(page).filter({ has: page.getByRole("button", { name: nameAndYears, exact: true }) });
const filterButton = (page: Page, name: RegExp) => page.getByRole("group", { name: "Show" }).getByRole("button", { name });
const search = (page: Page) => page.getByRole("searchbox", { name: "Find someone" });
const circles = (page: Page) => page.getByRole("tabpanel").getByTestId("network-person");
const onWheel = (page: Page) => page.getByRole("tabpanel").getByTestId("wheel-person");
/** The relation shown under someone on the Wheel (their years, for the person in the middle). */
const relationOf = (page: Page, nameAndYears: string) => onWheel(page).filter({ has: page.getByRole("button", { name: nameAndYears, exact: true }) }).getByTestId("relation");
const wheelUrl = (person = true) => new RegExp(`/s/everyone\\?view=wheel&centre=[0-9a-f]{24}${person ? "&person=[0-9a-f]{24}" : ""}$`);
const centreOf = (page: Page) => new URL(page.url()).searchParams.get("centre");
const circle = (page: Page, nameAndYears: string) => circles(page).filter({ has: page.getByRole("button", { name: nameAndYears, exact: true }) });
/** The element's middle is within `slack` pixels of the canvas's middle, and it's drawn big enough to read. */
async function centred(page: Page, locator: Locator, slack = 20) {
  const canvas = await box(page.getByRole("tabpanel"));
  const b = await box(locator);
  return b.width > 80 && Math.abs(b.x + b.width / 2 - (canvas.x + canvas.width / 2)) < slack && Math.abs(b.y + b.height / 2 - (canvas.y + canvas.height / 2)) < slack;
}
/** ★ Everyone's address for a view, with anyone selected. */
const everyoneUrl = (view: string, person = false) => new RegExp(`/s/everyone\\?view=${view}${person ? "&person=[0-9a-f]{24}" : ""}$`);

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
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/s/everyone\\?view=network$`)); // a computer's first view (owner request)
  await expect(page.getByRole("tab", { name: "★ Everyone" })).toHaveAttribute("aria-selected", "true");
  await expect(viewButton(page, "Network")).toHaveAttribute("aria-pressed", "true");
  await expect(circles(page)).toHaveCount(36);
  await viewButton(page, "Tree").click();
  await expect(page).toHaveURL(everyoneUrl("tree"));
  await expect(viewButton(page, "Tree")).toHaveAttribute("aria-pressed", "true");
  await expect(cards(page)).toHaveCount(36);
  await expect(page.getByText("36 people · 12 couples")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sheet options" })).toHaveCount(0); // nothing to rename, pin, move or delete
  await expect(page.getByRole("button", { name: "New sheet", exact: true })).toBeVisible();
  await page.waitForTimeout(300); // let the tree settle for the picture
  await page.screenshot({ path: "test-results/screenshots/everyone-tree.png" });

  await page.reload();
  await expect(page).toHaveURL(everyoneUrl("tree")); // not sent back to the first sheet
  await expect(cards(page)).toHaveCount(36);
  await page.getByRole("tab", { name: "Jerry Willow's family" }).click();
  await expect(cards(page)).toHaveCount(32);
  await page.goBack();
  await expect(page.getByRole("tab", { name: "★ Everyone" })).toHaveAttribute("aria-selected", "true");
});

test("Find someone selects them and brings their card into view; Go to a sheet that shows them, and Back", async ({ page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/everyone?view=tree`);
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
  await expect(page).toHaveURL(everyoneUrl("tree", true)); // Taylor Humes is still selected
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
  await expect(circles(page)).toHaveCount(37);
  await viewButton(page, "Tree").click();
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
  await page.goto(`/g/${groupId}/s/everyone?view=tree`);
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
    await expect(circles(viewerPage)).toHaveCount(36);
    await viewButton(viewerPage, "Tree").click();
    await expect(cards(viewerPage)).toHaveCount(36);
    await find(viewerPage).fill("jerry");
    await find(viewerPage).press("Enter");
    await expect(personPanel(viewerPage).getByRole("button", { name: "Go to Jerry Willow's family" })).toBeVisible();
    await expect(personPanel(viewerPage).getByRole("button", { name: "Edit details" })).toHaveCount(0);
    await expect(viewerPage.getByRole("button", { name: "Export" })).toBeVisible(); // the Tree's picture

    // The List too, with nothing to export there.
    await viewButton(viewerPage, "List").click();
    await expect(listRows(viewerPage)).toHaveCount(36);
    await expect(listRow(viewerPage, "Jerry Willow, 1920 – 1989")).toHaveAttribute("aria-current", "true");
    await expect(viewerPage.getByRole("button", { name: "Export" })).toHaveCount(0);

    // And the Network, with its picture, and the Wheel around Jerry Willow, selected.
    await viewButton(viewerPage, "Network").click();
    await expect(circles(viewerPage)).toHaveCount(36);
    await expect(viewerPage.getByRole("button", { name: "Export" })).toBeVisible();
    await viewButton(viewerPage, "Wheel").click();
    await expect(onWheel(viewerPage)).toHaveCount(36);
    await expect(relationOf(viewerPage, "Jake Cruz, 1945 – 2022")).toHaveText("Koduku");
  } finally {
    await viewerPage.context().close();
  }
});

test("the List: everyone with their relations and sheets; a row opens the panel, a sheet opens with them selected", async ({ page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/everyone`);
  await expect(page).toHaveURL(everyoneUrl("network")); // a link without a view: a computer's first view
  await viewButton(page, "List").click();
  await expect(page).toHaveURL(everyoneUrl("list"));
  await expect(viewButton(page, "List")).toHaveAttribute("aria-pressed", "true");
  await expect(listRows(page)).toHaveCount(36);
  await expect(page.getByText("36 people · 12 couples")).toBeVisible();
  const steve = listRow(page, "Steve Cruz, 1985");
  await expect(steve.getByRole("cell")).toHaveText([
    /^SCSteve Cruz1985/,
    "1985",
    "2001 · Sammie8 Sep 2008 · Arham",
    "Olivia Cruz, Arjun Patel",
    "Sammie Chang (divorced), Arham Chopra",
    "3 · William Cruz, Anna Cruz, Taylor Cruz",
    "Cruz familyJerry Willow's family",
  ]);
  await page.screenshot({ path: "test-results/screenshots/everyone-list.png" });

  await steve.getByRole("button", { name: "Steve Cruz, 1985" }).click();
  await expect(personPanel(page).getByRole("heading", { name: "Steve Cruz" })).toBeVisible();
  await expect(steve).toHaveAttribute("aria-current", "true");
  await expect(page).toHaveURL(everyoneUrl("list", true));
  await expect(personPanel(page).getByRole("button", { name: "Find in list" })).toHaveCount(0); // already there

  // A sheet in his row opens it, with him still selected; Back returns to the List.
  await steve.getByRole("button", { name: "Cruz family" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
  await expect(cards(page)).toHaveCount(36);
  await expect(personPanel(page).getByRole("heading", { name: "Steve Cruz" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(everyoneUrl("list", true));
  await expect(listRow(page, "Steve Cruz, 1985")).toHaveAttribute("aria-current", "true");

  // A reload keeps the view and the person.
  await page.reload();
  await expect(listRow(page, "Steve Cruz, 1985")).toHaveAttribute("aria-current", "true");
  await expect(personPanel(page).getByRole("heading", { name: "Steve Cruz" })).toBeVisible();

  // The Tree opens at him; Back returns to the List, Forward to the Tree.
  await viewButton(page, "Tree").click();
  await expect(page).toHaveURL(everyoneUrl("tree", true));
  const canvas = await box(page.getByRole("tabpanel"));
  await expect.poll(async () => {
    const card = await box(cards(page).filter({ hasText: "Steve Cruz" }));
    return card.width > 105 && Math.abs(card.x + card.width / 2 - (canvas.x + canvas.width / 2)) < 20;
  }).toBe(true); // readable, in the middle
  await page.goBack();
  await expect(listRows(page)).toHaveCount(36);
  await page.goForward();
  await expect(cards(page)).toHaveCount(36);

  // The last view used is remembered on this device.
  await viewButton(page, "List").click();
  await page.getByRole("tab", { name: "Cruz family" }).click();
  await page.getByRole("tab", { name: "★ Everyone" }).click();
  await expect(page).toHaveURL(everyoneUrl("list", true));
  await expect(listRows(page)).toHaveCount(36);
});

test("the List's filters and Find someone, with someone on no sheet; Export has only the data", async ({ page, signIn, sampleGroup, database }) => {
  const { owner, groupId } = await sampleOwner(page, signIn, sampleGroup);
  await applyOperations(database, groupId, [{ op: "createPerson", tempId: "new:zoe", name: "Zoë Ávila", gender: "female", birthYear: 1990 }], owner.id);
  await page.goto(`/g/${groupId}/s/everyone?view=list`);
  await expect(page.getByRole("group", { name: "Show" }).getByRole("button")).toHaveText(["Everyone (37)", "Living (26)", "Married in (7)", "On no sheet (1)"]);
  await expect(filterButton(page, /^Everyone/)).toHaveAttribute("aria-pressed", "true");

  await filterButton(page, /^On no sheet/).click();
  await expect(listRows(page)).toHaveCount(1);
  await expect(listRow(page, "Zoë Ávila, 1990").getByRole("cell").last()).toHaveText("–");
  await filterButton(page, /^Married in/).click();
  await expect(listRows(page)).toHaveCount(7);
  await search(page).fill("young");
  await expect(listRows(page)).toHaveCount(1);
  await expect(listRow(page, "Timothy Young, 1970")).toBeVisible();

  // What was typed stays while switching views, but the Tree has its own drop-down.
  await viewButton(page, "Tree").click();
  await expect(find(page)).toHaveValue("");
  await viewButton(page, "List").click();
  await expect(search(page)).toHaveValue("young");

  await search(page).fill("nobody");
  await expect(page.getByText("Nobody matches.")).toBeVisible();
  await page.getByRole("button", { name: "Show everyone" }).click();
  await expect(listRows(page)).toHaveCount(37);
  await expect(search(page)).toHaveValue("");
  await expect(filterButton(page, /^Everyone/)).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("menu", { name: "Export" }).getByRole("menuitem")).toHaveText(["Data: whole group (GEDCOM)", "Data: whole group (JSON)"]);
});

test("Find in list, from a sheet: the List with their row selected and on the screen", async ({ page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await page.getByRole("tabpanel").getByRole("button", { name: "Tay Young, 2005" }).click();
  await personPanel(page).getByRole("button", { name: "Find in list" }).click();
  await expect(page).toHaveURL(everyoneUrl("list", true));
  const tay = listRow(page, "Tay Young, 2005");
  await expect(tay).toHaveAttribute("aria-current", "true");
  await expect(tay).toBeInViewport({ ratio: 1 });
  await expect(personPanel(page).getByRole("heading", { name: "Tay Young" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
});

test("the Network: everyone and every couple; choosing someone lights up their relations; a heart opens the couple", async ({ page, signIn, sampleGroup }) => {
  const { groupId } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/everyone?view=tree`);
  await expect(page.getByRole("group", { name: "View" }).getByRole("button")).toHaveText(["Tree", "Network", "Wheel", "List", "Upcoming"]);
  await viewButton(page, "Network").click();
  await expect(page).toHaveURL(everyoneUrl("network"));
  await expect(viewButton(page, "Network")).toHaveAttribute("aria-pressed", "true");
  await expect(circles(page)).toHaveCount(36);
  await expect(page.getByRole("tabpanel").getByRole("button", { name: /, (married|divorced)$/ })).toHaveCount(12);
  await expect(page.getByRole("group", { name: "Key" })).toBeVisible();
  // Bigger circles have more relations: Steve Cruz (7) over Alex Cruz (2).
  const photo = (name: string) => circle(page, name).locator("div.rounded-full").first();
  expect((await box(photo("Steve Cruz, 1985"))).width / (await box(photo("Alex Cruz, 2021"))).width).toBeGreaterThan(1.4); // whatever the zoom
  await page.waitForTimeout(300); // let the network settle for the picture
  await page.screenshot({ path: "test-results/screenshots/everyone-network.png" });

  // Steve Cruz: his panel, his relatives lit up, everyone else faded.
  await page.getByRole("tabpanel").getByRole("button", { name: "Steve Cruz, 1985" }).click();
  await expect(personPanel(page).getByRole("heading", { name: "Steve Cruz" })).toBeVisible();
  await expect(page).toHaveURL(everyoneUrl("network", true));
  await expect(personPanel(page).getByRole("button", { name: "Show in network" })).toHaveCount(0); // already there
  for (const name of ["Olivia Cruz, 1960", "Arham Chopra, 1983", "Sammie Chang, 1985", "Anna Cruz, 2012"]) await expect(circle(page, name), name).not.toHaveClass(/opacity-25/);
  await expect(circle(page, "Jerry Willow, 1920 – 1989")).toHaveClass(/opacity-25/);
  await page.screenshot({ path: "test-results/screenshots/everyone-network-chosen.png" });

  // A heart opens the couple panel, as on the Tree.
  await page.getByRole("tabpanel").getByRole("button", { name: "Steve Cruz and Arham Chopra, married" }).click();
  await expect(page.getByRole("complementary", { name: "Couple details" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menu", { name: "Export" }).getByRole("menuitem", { name: "Picture (PNG)" }).click();
  expect((await download).suggestedFilename()).toBe("Everyone network.png");
});

test("Show in network from a sheet, and Find someone, centre a circle; a reload keeps the view and the person", async ({ page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await page.getByRole("tabpanel").getByRole("button", { name: "Tay Young, 2005" }).click();
  await personPanel(page).getByRole("button", { name: "Show in network" }).click();
  await expect(page).toHaveURL(everyoneUrl("network", true));
  await expect(personPanel(page).getByRole("heading", { name: "Tay Young" })).toBeVisible();
  await expect.poll(() => centred(page, circle(page, "Tay Young, 2005"))).toBe(true);

  await page.reload();
  await expect(personPanel(page).getByRole("heading", { name: "Tay Young" })).toBeVisible();
  await expect.poll(() => centred(page, circle(page, "Tay Young, 2005"))).toBe(true);

  await find(page).fill("amelia");
  await page.getByRole("option", { name: "Amelia Young (2001)" }).click();
  await expect(personPanel(page).getByRole("heading", { name: "Amelia Young" })).toBeVisible();
  await expect.poll(() => centred(page, circle(page, "Amelia Young, 2001"))).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
});

test("the Wheel: Steve Cruz in the middle, everyone else labelled in Telugu or English; tapping says how; Put in the middle", async ({ page, signIn, sampleGroup }) => {
  const { groupId } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/everyone?view=tree`);
  await expect(page.getByRole("group", { name: "View" }).getByRole("button")).toHaveText(["Tree", "Network", "Wheel", "List", "Upcoming"]);
  await find(page).fill("steve");
  await page.getByRole("option", { name: "Steve Cruz (1985)" }).click();
  await viewButton(page, "Wheel").click(); // around the person selected
  await expect(page).toHaveURL(wheelUrl());
  const steve = centreOf(page);
  await expect(onWheel(page)).toHaveCount(36);
  await expect(relationOf(page, "Steve Cruz, 1985")).toHaveText("1985"); // the middle shows his years
  const names = page.getByRole("group", { name: "Relation names" });
  await expect(names.getByRole("button", { name: "Telugu names" })).toHaveAttribute("aria-pressed", "true");
  for (const [who, telugu] of [["Olivia Cruz, 1960", "Amma"], ["Jake Cruz, 1945 – 2022", "Menamama"], ["Christina Cruz, 1978", "Vadina"], ["Jane Howell, 2002", "Kodalu"], ["Amy Harolds, 1885 – 1966", "Muthavva"]]) {
    await expect(relationOf(page, who), who).toHaveText(telugu);
  }
  await expect(page.getByRole("region", { name: "Relatives" })).toContainText("Steve Cruz's relatives");
  await expect(page.getByRole("region", { name: "Relatives" })).toContainText("Cousins11");
  await page.waitForTimeout(500); // let the wheel settle for the picture
  await page.screenshot({ path: "test-results/screenshots/everyone-wheel.png" });

  // English names, remembered on this device.
  await names.getByRole("button", { name: "English names" }).click();
  await expect(relationOf(page, "Olivia Cruz, 1960")).toHaveText("Mother");
  await expect(relationOf(page, "Christina Cruz, 1978")).toHaveText("Cousin");
  await expect(relationOf(page, "Taylor Humes, 1955")).toHaveText("Uncle's wife");
  await page.reload();
  await expect(relationOf(page, "Olivia Cruz, 1960")).toHaveText("Mother");
  await names.getByRole("button", { name: "Telugu names" }).click();
  await expect(relationOf(page, "Olivia Cruz, 1960")).toHaveText("Amma");

  // Tapping someone opens their panel, saying how they're related; the middle stays put.
  await page.getByRole("tabpanel").getByRole("button", { name: "Jake Cruz, 1945 – 2022" }).click();
  const relation = personPanel(page).getByRole("group", { name: "Relation" });
  await expect(relation).toContainText("Menamama · Uncle");
  await expect(relation).toContainText("Steve Cruz's mother's elder brother");
  expect(centreOf(page)).toBe(steve);
  await expect(personPanel(page).getByRole("button", { name: "Relatives wheel" })).toHaveCount(0); // already there

  // Put in the middle: Jake Cruz, his sister's son Steve is his Menalludu; a reload keeps it.
  await relation.getByRole("button", { name: "Put in the middle" }).click();
  await expect(relationOf(page, "Steve Cruz, 1985")).toHaveText("Menalludu");
  expect(centreOf(page)).not.toBe(steve);
  await expect(personPanel(page).getByRole("group", { name: "Relation" })).toHaveText("In the middle of the wheel");
  await page.reload();
  await expect(relationOf(page, "Steve Cruz, 1985")).toHaveText("Menalludu");
  await expect(relationOf(page, "Jake Cruz, 1945 – 2022")).toHaveText("1945 – 2022");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menu", { name: "Export" }).getByRole("menuitem", { name: "Picture (PNG)" }).click();
  expect((await download).suggestedFilename()).toBe("Jake Cruz's relatives.png");
});

test("Relatives wheel from a sheet, and Find someone in the Wheel, move the middle", async ({ page, signIn, sampleGroup }) => {
  const { groupId, cruzSheet } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await page.getByRole("tabpanel").getByRole("button", { name: "Tay Young, 2005" }).click();
  await personPanel(page).getByRole("button", { name: "Relatives wheel" }).click();
  await expect(page).toHaveURL(wheelUrl());
  await expect(relationOf(page, "Tay Young, 2005")).toHaveText("2005");
  await expect(relationOf(page, "Christina Cruz, 1978")).toHaveText("Amma");
  await expect(relationOf(page, "Carrie Young, 2001")).toHaveText("Akka");

  await find(page).fill("alexander");
  await page.getByRole("option", { name: "Alexander Cruz (1918 – 2003)" }).click();
  await expect(relationOf(page, "Alexander Cruz, 1918 – 2003")).toHaveText("1918 – 2003");
  await expect(relationOf(page, "Jerry Willow, 1920 – 1989")).toHaveText("Bhartha"); // a same-sex couple
  await page.goBack(); // the middle before
  await expect(relationOf(page, "Tay Young, 2005")).toHaveText("2005");
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/s/${cruzSheet}$`));
});

test("the List's Born column: full dates, and sorting oldest first, youngest first and back (owner request)", async ({ page, signIn, sampleGroup, database }) => {
  const { owner, groupId } = await sampleOwner(page, signIn, sampleGroup);
  const tree = await loadGroupTree(database.db, groupId);
  const steveId = tree.persons.find((p) => p.name === "Steve Cruz")!.id;
  await applyOperations(database, groupId, [{ op: "updatePerson", personId: steveId, set: { birthMonth: 3, birthDay: 12 } }], owner.id);
  await page.goto(`/g/${groupId}/s/everyone?view=list`);
  await expect(listRow(page, "Steve Cruz, 1985").getByRole("cell").nth(1)).toHaveText("12 Mar 1985");
  await expect(listRow(page, "Jake Cruz, 1945 – 2022").getByRole("cell").nth(1)).toHaveText("1945Died 2022");
  const first = () => listRows(page).first().getByRole("button").first();
  await expect(first()).toHaveAccessibleName("Alex Cruz, 2021"); // A to Z by default

  const born = page.getByRole("table", { name: "People" }).getByRole("button", { name: /^Born/ });
  await born.click();
  await expect(first()).toHaveAccessibleName("Timothy Cruz, 1880 – 1962");
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("oldest");
  await born.click();
  await expect(first()).toHaveAccessibleName("Alex Cruz, 2021");
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("youngest");
  await born.click();
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("name");
  await page.getByRole("combobox", { name: "Sort" }).selectOption({ label: "Oldest first" });
  await expect(first()).toHaveAccessibleName("Timothy Cruz, 1880 – 1962");
});

test("the List's Married column: marriage dates, and sorting earliest first, latest first and back; the Tree shows them, the Network doesn't (owner request)", async ({ page, signIn, sampleGroup }) => {
  const { groupId } = await sampleOwner(page, signIn, sampleGroup);
  await page.goto(`/g/${groupId}/s/everyone?view=list`);
  await expect(listRow(page, "Steve Cruz, 1985").getByRole("cell").nth(2)).toHaveText("2001 · Sammie8 Sep 2008 · Arham");
  await expect(listRow(page, "Marvin Young, 1970").getByRole("cell").nth(2)).toHaveText("–");
  const first = () => listRows(page).first().getByRole("button").first();
  const sort = page.getByRole("combobox", { name: "Sort" });

  const married = page.getByRole("table", { name: "People" }).getByRole("button", { name: /^Married/ });
  await married.click();
  await expect(first()).toHaveAccessibleName("Amy Harolds, 1885 – 1966");
  await expect(sort).toHaveValue("marriedEarliest");
  await married.click();
  await expect(first()).toHaveAccessibleName("Arham Chopra, 1983");
  await expect(sort).toHaveValue("marriedLatest");
  await married.click();
  await expect(first()).toHaveAccessibleName("Alex Cruz, 2021");
  await expect(sort).toHaveValue("name");
  await sort.selectOption({ label: "Married, earliest first" });
  await expect(first()).toHaveAccessibleName("Amy Harolds, 1885 – 1966");

  await viewButton(page, "Tree").click();
  await expect(cards(page)).toHaveCount(36);
  const dates = page.getByRole("tabpanel").getByTestId("marriage-date");
  await expect(dates).toHaveCount(5);
  expect((await dates.allTextContents()).sort()).toEqual(["1910", "1972", "1983", "2001", "2008"]);
  await viewButton(page, "Network").click();
  await expect(circles(page)).toHaveCount(36);
  await expect(page.getByRole("tabpanel").getByTestId("marriage-date")).toHaveCount(0);
});

test("Upcoming: birthdays and anniversaries nearest first; a row opens the person or the couple; the dashboard has the next 30 days (owner request)", async ({ page, signIn, sampleGroup, database }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 10)); // Wednesday 21 October 2026, on the device
  const { owner, groupId } = await sampleOwner(page, signIn, sampleGroup);
  const tree = await loadGroupTree(database.db, groupId);
  const id = (name: string) => tree.persons.find((p) => p.name === name)!.id;
  const born = (name: string, birthMonth: number, birthDay: number) => ({ op: "updatePerson", personId: id(name), set: { birthMonth, birthDay } });
  await applyOperations(
    database,
    groupId,
    [
      born("Steve Cruz", 10, 21),
      born("Amelia Young", 10, 22),
      born("Arham Chopra", 11, 3),
      born("Jake Cruz", 10, 25),
      { op: "updatePerson", personId: id("Olivia Cruz"), set: { birthYear: 1966, birthMonth: 11, birthDay: 10 } }, // her 60th: a milestone
    ],
    owner.id,
  );

  await page.goto(`/g/${groupId}/s/everyone?view=upcoming`);
  const rows = page.getByRole("tabpanel").getByTestId("upcoming-row");
  await expect(rows).toHaveText([
    "Wed 21 OctTodaySCSteve CruzTurns 41",
    "Thu 22 OctTomorrowAYAmelia YoungTurns 25",
    "Tue 3 NovIn 13 daysACArham ChopraTurns 43",
    "Tue 10 NovIn 20 daysOCOlivia CruzTurns 60Shashtipurti",
    "Wed 8 SepSCACSteve Cruz & Arham Chopra19th anniversary", // Jake Cruz has died: no birthday, no anniversary with Taylor
  ]);
  await expect(page.getByRole("tabpanel").getByRole("heading")).toHaveText(["October 2026", "November 2026", "September 2027"]);
  await expect(page.getByText("21 living people have no birthday (day and month) saved, so their birthdays aren't shown.")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/everyone-upcoming.png" });

  // A birthday opens the person, with their age; an anniversary the couple.
  await rows.first().click();
  await expect(personPanel(page).getByRole("heading", { name: "Steve Cruz" })).toBeVisible();
  await expect(personPanel(page)).toContainText("41 years old");
  await expect(rows.first()).toHaveAttribute("aria-current", "true");
  await expect(page).toHaveURL(new RegExp(`/s/everyone\\?view=upcoming&person=${tree.persons.find((p) => p.name === "Steve Cruz")!.id}$`));
  await rows.last().click();
  await expect(page.getByRole("complementary", { name: "Couple details" })).toContainText("8 Sep 2008");
  // Find someone selects their row.
  await find(page).fill("Amelia");
  await page.getByRole("option", { name: /Amelia Young/ }).click();
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");

  // The dashboard: the next 30 days, each opening its group's Upcoming.
  await page.goto("/dashboard");
  // Each row: the initials, what, the group (and how soon, after tomorrow), the day, a milestone.
  const soon = page.getByRole("region", { name: "Coming up", exact: true }).getByRole("link");
  await expect(soon).toHaveText([
    "SCSteve Cruz turns 41Cruz familyToday",
    "AYAmelia Young turns 25Cruz familyTomorrow",
    "ACArham Chopra turns 43Cruz family · in 13 daysTue 3 Nov",
    "OCOlivia Cruz turns 60Cruz family · in 20 daysTue 10 NovShashtipurti",
  ]);
  // The page's top part: the welcome and Upcoming (a README picture).
  const main = await box(page.getByRole("main"));
  const section = await box(page.getByRole("region", { name: "Coming up", exact: true }));
  await page.screenshot({ path: "test-results/screenshots/dashboard-upcoming.png", clip: { x: main.x, y: main.y, width: main.width, height: section.y + section.height - main.y + 32 } });
  await soon.nth(1).click();
  await expect(page).toHaveURL(/\/s\/everyone\?view=upcoming&person=[0-9a-f]{24}$/);
  await expect(personPanel(page).getByRole("heading", { name: "Amelia Young" })).toBeVisible();
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
});

test("the dashboard's Coming up says so when nothing is in the next 30 days (owner request)", async ({ page, signIn, sampleGroup }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 10)); // Steve and Arham's anniversary is on 8 September
  await sampleOwner(page, signIn, sampleGroup);
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "My groups", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Coming up", exact: true })).toContainText("Nothing in the next 30 days.");
});
