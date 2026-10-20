import type { Page } from "@playwright/test";
import { loadGroupTree } from "@/server/repositories/family";
import { applyGroupChanges } from "@/server/repositories/groups";
import { setPhotoOps } from "@/tree/edits";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

test.use({ viewport: { width: 1600, height: 1000 } });

// Uploads and deletes go to the Cloudinary stand-in (e2e/cloudinary-stub.mts). Photo URLs on
// res.cloudinary.com are answered here with this 1×1 PNG, so no test reaches Cloudinary.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const servePhotos = (page: Page) => page.route("https://res.cloudinary.com/**", (route) => route.fulfill({ contentType: "image/png", body: PNG }));
const stub = process.env.E2E_CLOUDINARY_URL!;
const stubCalls = async () => (await (await fetch(`${stub}/calls`)).json()) as { uploaded: string[]; deleted: string[] };

const cards = (page: Page) => page.getByTestId("person-card");
const card = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("button", { name: new RegExp(`^${name}(,|$)`) });
/** A person's whole card on the current sheet, and the photo on it. */
const wholeCard = (page: Page, name: string) =>
  page.getByRole("tabpanel").getByTestId("person-card").filter({ has: page.getByRole("button", { name: new RegExp(`^${name}(,|$)`) }) });
const cardPhoto = (page: Page, name: string) => wholeCard(page, name).locator("img");
const personPanel = (page: Page) => page.getByRole("complementary", { name: "Person details" });
const photoIdIn = (src: string | null) => /\/f_auto,q_auto\/(groups\/.+)$/.exec(src ?? "")?.[1];

async function openSampleGroup(page: Page, signIn: SignIn, sampleGroup: SampleGroup) {
  const owner = await signIn(page, "Carla Cruz");
  const group = await sampleGroup(owner);
  await page.goto(`/g/${group.groupId}/s/${group.cruzSheet}`);
  await expect(cards(page)).toHaveCount(36);
  return { ...group, owner };
}

/** Clicks a photo button in the person panel and picks `file` in the file chooser. */
async function choosePhoto(page: Page, button: string, file = { name: "photo.png", mimeType: "image/png", buffer: PNG }) {
  const chooser = page.waitForEvent("filechooser");
  await personPanel(page).getByRole("button", { name: button }).click();
  await (await chooser).setFiles(file);
}

test("add, change and remove a photo; a replaced photo is deleted from Cloudinary", async ({ page, signIn, sampleGroup }) => {
  await servePhotos(page);
  const { groupId } = await openSampleGroup(page, signIn, sampleGroup);

  await card(page, "Jake Cruz").click();
  await choosePhoto(page, "Add photo");
  const inFolder = new RegExp(`/image/upload/c_thumb,g_face,w_168,h_168/f_auto,q_auto/groups/${groupId}/[\\w-]{22}$`);
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", inFolder);
  const first = photoIdIn(await cardPhoto(page, "Jake Cruz").getAttribute("src"))!;
  expect((await stubCalls()).uploaded).toContain(first); // signed correctly, or the stand-in would refuse it
  await expect.poll(() => cardPhoto(page, "Jake Cruz").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  await expect(personPanel(page).locator("img")).toHaveAttribute("src", inFolder);

  // Everywhere Jake is shown, and still there after a reload.
  await page.getByRole("tab", { name: "Jerry Willow's family" }).click();
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", new RegExp(`${first}$`));
  await page.reload();
  await expect(cardPhoto(page, "Jake Cruz")).toHaveAttribute("src", new RegExp(`${first}$`));

  await card(page, "Jake Cruz").click();
  await choosePhoto(page, "Change photo");
  await expect(cardPhoto(page, "Jake Cruz")).not.toHaveAttribute("src", new RegExp(`${first}$`));
  const second = photoIdIn(await cardPhoto(page, "Jake Cruz").getAttribute("src"))!;
  await expect.poll(async () => (await stubCalls()).deleted).toContain(first);

  await personPanel(page).getByRole("button", { name: "Remove photo" }).click();
  await personPanel(page).getByRole("group", { name: "Remove photo" }).getByRole("button", { name: "Remove", exact: true }).click();
  await expect(cardPhoto(page, "Jake Cruz")).toHaveCount(0);
  await expect(wholeCard(page, "Jake Cruz")).toContainText("JC"); // initials again
  await expect(personPanel(page).getByRole("button", { name: "Add photo" })).toBeVisible();
  await expect.poll(async () => (await stubCalls()).deleted).toContain(second);
});

test("a file that's too big or isn't a photo is refused before uploading", async ({ page, signIn, sampleGroup }) => {
  await openSampleGroup(page, signIn, sampleGroup);
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(stub)) uploads.push(request.url());
  });

  await card(page, "Jake Cruz").click();
  await choosePhoto(page, "Add photo", { name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(personPanel(page).getByRole("alert")).toHaveText("Choose a JPEG, PNG, WebP or HEIC photo.");
  await choosePhoto(page, "Add photo", { name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
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
    for (const action of ["Add photo", "Change photo", "Remove photo"]) {
      await expect(panel.getByRole("button", { name: action })).toHaveCount(0);
    }
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
