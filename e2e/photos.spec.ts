import type { Locator, Page } from "@playwright/test";
import sharp from "sharp";
import { loadGroupTree } from "@/server/repositories/family";
import { applyGroupChanges } from "@/server/repositories/groups";
import { setPhotoOps } from "@/tree/edits";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

test.use({ viewport: { width: 1600, height: 1000 } });

// Uploads and deletes go to the Cloudinary stand-in (e2e/cloudinary-stub.mts). Photo URLs on
// res.cloudinary.com are answered here with a 600 × 400 PNG (a "group photo": a blue left half and an
// orange right half), so no test reaches Cloudinary.
let made: Promise<Buffer> | undefined;
const groupPhoto = () =>
  (made ??= sharp({ create: { width: 600, height: 400, channels: 3, background: "#3b82f6" } })
    .composite([{ input: { create: { width: 300, height: 400, channels: 3, background: "#f97316" } }, left: 300, top: 0 }])
    .png()
    .toBuffer());
const servePhotos = (page: Page) => page.route("https://res.cloudinary.com/**", async (route) => route.fulfill({ contentType: "image/png", body: await groupPhoto() }));
const stub = process.env.E2E_CLOUDINARY_URL!;
const stubCalls = async () =>
  (await (await fetch(`${stub}/calls`)).json()) as { uploaded: string[]; sizes: Record<string, { width: number; height: number } | null>; deleted: string[] };

const cards = (page: Page) => page.getByTestId("person-card");
const card = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("button", { name: new RegExp(`^${name}(,|$)`) });
/** A person's whole card on the current sheet, and the photo on it. */
const wholeCard = (page: Page, name: string) =>
  page.getByRole("tabpanel").getByTestId("person-card").filter({ has: page.getByRole("button", { name: new RegExp(`^${name}(,|$)`) }) });
const cardPhoto = (page: Page, name: string) => wholeCard(page, name).locator("img");
const personPanel = (page: Page) => page.getByRole("complementary", { name: "Person details" });
const photoIdIn = (src: string | null) => /\/f_auto,q_auto\/(groups\/.+)$/.exec(src ?? "")?.[1];
/** The rectangle in a card's photo URL, or null without one. */
const cropIn = (src: string | null) => {
  const m = /c_crop,x_([\d.]+),y_([\d.]+),w_([\d.]+),h_([\d.]+)\//.exec(src ?? "");
  return m ? { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) } : null;
};
const photoOptions = (page: Page, name: string) => personPanel(page).getByRole("button", { name: `Photo options for ${name}` });
const markDialog = (page: Page, name: string) => page.getByRole("dialog", { name: `Which one is ${name}?` });
const moreDialog = (page: Page) => page.getByRole("dialog", { name: "Also use this photo for someone else?" });

/** Drags across the dialog's photo between two points given as fractions of it. */
async function dragOnPhoto(dialog: Locator, from: [number, number], to: [number, number]) {
  const photo = dialog.getByRole("group", { name: /^The photo: where is/ });
  await expect.poll(() => photo.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(600);
  await expect.poll(async () => (await photo.boundingBox())?.width).toBeGreaterThan(300); // the dialog has grown in
  const box = (await photo.boundingBox())!;
  const page = dialog.page();
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 8 });
  await page.mouse.up();
}

const near = (actual: { x: number; y: number; w: number; h: number } | null, expected: { x: number; y: number; w: number; h: number }) => {
  expect(actual).not.toBeNull();
  for (const key of ["x", "y", "w", "h"] as const) expect(Math.abs(actual![key] - expected[key]), key).toBeLessThan(0.03);
};

async function openSampleGroup(page: Page, signIn: SignIn, sampleGroup: SampleGroup) {
  const owner = await signIn(page, "Carla Cruz");
  const group = await sampleGroup(owner);
  await page.goto(`/g/${group.groupId}/s/${group.cruzSheet}`);
  await expect(cards(page)).toHaveCount(36);
  return { ...group, owner };
}

/**
 * Picks `file` in the file chooser, opened by the photo itself (`Add a photo of …`, no photos in the tree
 * yet) or by an item of its menu ("Change photo…", "Upload a photo…").
 */
async function choosePhoto(page: Page, name: string, item: string | null, file?: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  if (item === null) await personPanel(page).getByRole("button", { name: `Add a photo of ${name}` }).click();
  else {
    await photoOptions(page, name).click();
    await page.getByRole("menu", { name: "Photo options" }).getByRole("menuitem", { name: item }).click();
  }
  await (await chooser).setFiles(file ?? { name: "photo.png", mimeType: "image/png", buffer: await groupPhoto() });
}

/** After an upload: the whole photo, and no one else in it. */
async function wholePhoto(page: Page, name: string) {
  await markDialog(page, name).getByRole("button", { name: "Whole photo" }).click();
  await moreDialog(page).getByRole("button", { name: "Done" }).click();
  await expect(moreDialog(page)).toHaveCount(0);
}

test("add, change and remove a photo; a replaced photo is deleted from Cloudinary", async ({ page, signIn, sampleGroup }) => {
  await servePhotos(page);
  const { groupId } = await openSampleGroup(page, signIn, sampleGroup);

  await card(page, "Jake Cruz").click();
  await choosePhoto(page, "Jake Cruz", null);
  await wholePhoto(page, "Jake Cruz");
  const inFolder = new RegExp(`/image/upload/c_thumb,g_face,w_168,h_168/f_auto,q_auto/groups/${groupId}/[\\w-]{22}$`);
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", inFolder);
  const first = photoIdIn(await cardPhoto(page, "Jake Cruz").getAttribute("src"))!;
  expect((await stubCalls()).uploaded).toContain(first); // signed correctly, or the stand-in would refuse it
  await expect.poll(() => cardPhoto(page, "Jake Cruz").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(600);
  await expect(personPanel(page).locator("img")).toHaveAttribute("src", inFolder);

  // Everywhere Jake is shown, and still there after a reload.
  await page.getByRole("tab", { name: "Jerry Willow's family" }).click();
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", new RegExp(`${first}$`));
  await page.reload();
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", new RegExp(`${first}$`));

  await card(page, "Jake Cruz").click();
  await choosePhoto(page, "Jake Cruz", "Change photo…");
  await wholePhoto(page, "Jake Cruz");
  await expect(cardPhoto(page, "Jake Cruz")).not.toHaveAttribute("src", new RegExp(`${first}$`));
  const second = photoIdIn(await cardPhoto(page, "Jake Cruz").getAttribute("src"))!;
  await expect.poll(async () => (await stubCalls()).deleted).toContain(first);

  await photoOptions(page, "Jake Cruz").click();
  await page.getByRole("menuitem", { name: "Remove photo…" }).click();
  const remove = page.getByRole("dialog", { name: "Remove photo?" });
  await expect(remove).toContainText("Jake Cruz's photo will be deleted, so this can't be undone.");
  await remove.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(cardPhoto(page, "Jake Cruz")).toHaveCount(0);
  await expect(wholeCard(page, "Jake Cruz")).toContainText("JC"); // initials again
  await expect(personPanel(page).getByRole("button", { name: "Add a photo of Jake Cruz" })).toBeVisible();
  await expect.poll(async () => (await stubCalls()).deleted).toContain(second);
});

test("a group photo: mark who's who, adjust it, use it for someone else, and it's deleted only when the last one lets it go (owner request)", async ({ page, signIn, sampleGroup }) => {
  await servePhotos(page);
  const { groupId } = await openSampleGroup(page, signIn, sampleGroup);
  // The stand-in is shared by tests running at the same time: count only this group's photos.
  const ours = async () => {
    const calls = await stubCalls();
    const mine = (ids: string[]) => ids.filter((id) => id.startsWith(`groups/${groupId}/`));
    return { uploaded: mine(calls.uploaded), deleted: mine(calls.deleted) };
  };

  // Jake is on the left of the photo.
  await card(page, "Jake Cruz").click();
  await choosePhoto(page, "Jake Cruz", null);
  const jakeDialog = markDialog(page, "Jake Cruz");
  await expect(jakeDialog.getByRole("button", { name: "Save" })).toBeDisabled(); // nothing drawn yet
  await dragOnPhoto(jakeDialog, [0.1, 0.1], [0.45, 0.9]);
  await expect(jakeDialog.getByTestId("photo-crop")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/photo-crop.png", animations: "disabled" });
  await page.emulateMedia({ colorScheme: "dark" }); // Follow device
  await page.screenshot({ path: "test-results/screenshots/night-photo-crop.png", animations: "disabled" });
  await page.emulateMedia({ colorScheme: "light" });
  await jakeDialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => cropIn(await cardPhoto(page, "Jake Cruz").getAttribute("src"))).not.toBeNull();
  near(cropIn(await cardPhoto(page, "Jake Cruz").getAttribute("src")), { x: 0.1, y: 0.1, w: 0.35, h: 0.8 });
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", /\/c_thumb,g_face,w_168,h_168\//); // the face, inside the rectangle
  const photo = photoIdIn(await cardPhoto(page, "Jake Cruz").getAttribute("src"))!;

  // Olivia is on the right of the same photo.
  const more = moreDialog(page);
  await expect(more).toContainText("Saved for Jake Cruz.");
  const someone = more.getByRole("combobox", { name: "Someone else in the photo" });
  await someone.selectOption((await someone.locator("option", { hasText: /^Olivia Cruz/ }).getAttribute("value"))!);
  await more.getByRole("button", { name: "Choose" }).click();
  await dragOnPhoto(markDialog(page, "Olivia Cruz"), [0.55, 0.05], [0.95, 0.95]);
  await markDialog(page, "Olivia Cruz").getByRole("button", { name: "Save" }).click();
  await expect(more).toContainText("Saved for Jake Cruz, Olivia Cruz.");
  await more.getByRole("button", { name: "Done" }).click();
  await expect(cardPhoto(page, "Olivia Cruz")).toHaveAttribute("src", new RegExp(`${photo}$`));
  near(cropIn(await cardPhoto(page, "Olivia Cruz").getAttribute("src")), { x: 0.55, y: 0.05, w: 0.4, h: 0.9 });
  expect((await ours()).uploaded).toEqual([photo]); // one upload for both

  // Adjust Jake's: the rectangle moves, with no new upload and nothing deleted.
  await photoOptions(page, "Jake Cruz").click();
  await page.getByRole("menuitem", { name: "Adjust photo…" }).click();
  await expect(jakeDialog.getByTestId("photo-crop")).toBeVisible(); // the saved one
  await dragOnPhoto(jakeDialog, [0.25, 0.5], [0.3, 0.45]); // inside it: moves it
  await jakeDialog.getByRole("button", { name: "Save" }).click();
  await expect(jakeDialog).toHaveCount(0);
  await expect.poll(async () => cropIn(await cardPhoto(page, "Jake Cruz").getAttribute("src"))?.x).toBeGreaterThan(0.13);
  near(cropIn(await cardPhoto(page, "Jake Cruz").getAttribute("src")), { x: 0.15, y: 0.05, w: 0.35, h: 0.8 });
  expect(await ours()).toEqual({ uploaded: [photo], deleted: [] });

  // Removing it from Jake keeps it for Olivia; removing it from her too deletes it.
  await photoOptions(page, "Jake Cruz").click();
  await page.getByRole("menuitem", { name: "Remove photo…" }).click();
  await expect(page.getByRole("dialog", { name: "Remove photo?" })).toContainText("It comes off Jake Cruz's card, and stays for the other person who uses it.");
  await page.getByRole("dialog", { name: "Remove photo?" }).getByRole("button", { name: "Remove", exact: true }).click();
  await expect(cardPhoto(page, "Jake Cruz")).toHaveCount(0);
  await expect(cardPhoto(page, "Olivia Cruz")).toHaveAttribute("src", new RegExp(`${photo}$`));
  expect((await ours()).deleted).toEqual([]);

  // Jake can take it again from the tree: the whole photo this time.
  await photoOptions(page, "Jake Cruz").click();
  await page.getByRole("menuitem", { name: "Use a photo from this tree…" }).click();
  await page.getByRole("dialog", { name: "Use a photo from this tree" }).getByRole("button", { name: "Photo of Olivia Cruz" }).click();
  await markDialog(page, "Jake Cruz").getByRole("button", { name: "Whole photo" }).click();
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", new RegExp(`/upload/c_thumb,g_face,w_168,h_168/f_auto,q_auto/${photo}$`));

  for (const name of ["Jake Cruz", "Olivia Cruz"]) {
    await card(page, name).click();
    await photoOptions(page, name).click();
    await page.getByRole("menuitem", { name: "Remove photo…" }).click();
    await page.getByRole("dialog", { name: "Remove photo?" }).getByRole("button", { name: "Remove", exact: true }).click();
    await expect(cardPhoto(page, name)).toHaveCount(0);
  }
  await expect.poll(async () => (await stubCalls()).deleted).toContain(photo);
});

test("a large camera photo is shrunk in the browser to 2400 px before it's uploaded (owner request)", async ({ page, signIn, sampleGroup }) => {
  await servePhotos(page);
  await openSampleGroup(page, signIn, sampleGroup);
  // Noise, so it's big like a camera's photo and its shrunk copy is smaller.
  const camera = await sharp({ create: { width: 4800, height: 3600, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 50 } } })
    .jpeg({ quality: 98 })
    .toBuffer();
  expect(camera.length).toBeGreaterThan(10 * 1024 * 1024); // more than Cloudinary would take

  await card(page, "Jake Cruz").click();
  await choosePhoto(page, "Jake Cruz", null, { name: "DSC_0001.JPG", mimeType: "image/jpeg", buffer: camera });
  await expect(markDialog(page, "Jake Cruz")).toBeVisible({ timeout: 30_000 });
  const photo = photoIdIn(await cardPhoto(page, "Jake Cruz").getAttribute("src"))!;
  expect((await stubCalls()).sizes[photo]).toEqual({ width: 2400, height: 1800 });
});

test("a file that's too big or isn't a photo is refused before uploading", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(stub)) uploads.push(request.url());
  });

  await card(page, "Jake Cruz").click();
  await choosePhoto(page, "Jake Cruz", null, { name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(personPanel(page).getByRole("alert")).toHaveText("Choose a JPEG, PNG, WebP or HEIC photo.");
  // Over 10 MB and unreadable, so it can't be shrunk (like a HEIC outside Safari).
  await choosePhoto(page, "Jake Cruz", null, { name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(personPanel(page).getByRole("alert")).toHaveText("That photo is over 10 MB. Choose a smaller one.");

  expect(uploads).toEqual([]);
  await expect(cardPhoto(page, "Jake Cruz")).toHaveCount(0);
});

test("a Viewer sees photos but no photo buttons", async ({ browser, page, signIn, sampleGroup, addMember, database }) => {
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  const jake = (await loadGroupTree(database.db, groupId)).persons.find((p) => p.name === "Jake Cruz")!.id;
  const photoId = `groups/${groupId}/viewer-test-photo`;
  await applyGroupChanges(database, groupId, owner.id, setPhotoOps(jake, photoId));

  const viewerPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await servePhotos(viewerPage);
    const viewer = await signIn(viewerPage, "Vera Viewer");
    await addMember(groupId, viewer, "view");
    await viewerPage.goto(`/g/${groupId}/s/${cruzSheet}`);
    await expect(cardPhoto(viewerPage, "Jake Cruz")).toHaveAttribute("src", new RegExp(`${photoId}$`));

    await expect(viewerPage.getByRole("button", { name: "Hide photos" })).toBeVisible(); // a view setting, for everyone

    await card(viewerPage, "Jake Cruz").click();
    const panel = personPanel(viewerPage);
    await expect(panel.locator("img")).toHaveAttribute("src", new RegExp(`${photoId}$`));
    await expect(panel.getByRole("button", { name: /photo/i })).toHaveCount(0);
  } finally {
    await viewerPage.context().close();
  }
});

test("the eye button hides every photo: cards, the panel and a saved picture show initials (owner request after step 11)", async ({ page, signIn, sampleGroup, database }) => {
  await servePhotos(page);
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  const jake = (await loadGroupTree(database.db, groupId)).persons.find((p) => p.name === "Jake Cruz")!.id;
  await applyGroupChanges(database, groupId, owner.id, setPhotoOps(jake, `groups/${groupId}/eye-test-photo`));
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await expect(cardPhoto(page, "Jake Cruz")).toHaveCount(1);

  const eye = page.getByRole("button", { name: "Hide photos" });
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await eye.click();
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tabpanel").locator("img")).toHaveCount(0); // the picture is made from this
  await expect(wholeCard(page, "Jake Cruz")).toContainText("JC");
  await card(page, "Jake Cruz").click();
  await expect(personPanel(page).locator("img")).toHaveCount(0);
  await expect(personPanel(page)).toContainText("JC");

  // Still hidden on another sheet, and in a picture saved from it.
  await page.getByRole("tab", { name: "Jerry Willow's family" }).click();
  await expect(wholeCard(page, "Jake Cruz")).toContainText("JC");
  await expect(page.getByRole("tabpanel").locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menu", { name: "Export" }).getByRole("menuitem", { name: "Picture (PNG)" }).click();
  await (await download).saveAs("test-results/screenshots/sheet-picture-no-photos.png"); // for checking by eye

  await eye.click();
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", new RegExp("eye-test-photo$"));
});
