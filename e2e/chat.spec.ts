import type { Page } from "@playwright/test";
import { applyGroupChanges } from "@/server/repositories/groups";
import { expect, test, type SampleGroup, type SignIn } from "./fixtures";

test.use({ viewport: { width: 1600, height: 1000 } });

// The model is a scripted stand-in (e2e/model-stub.mts): no test calls Anthropic.
const stubCalls = async () =>
  (await (await fetch(`${process.env.E2E_MODEL_URL}/calls`)).json()) as { tools: string[]; notes: string[]; lastQuestion: string }[];

const cards = (page: Page) => page.getByTestId("person-card");
const assistant = (page: Page) => page.getByRole("complementary", { name: "Family assistant" });
const conversation = (page: Page) => assistant(page).getByRole("log", { name: "Conversation" });

async function ask(page: Page, text: string) {
  await assistant(page).getByRole("textbox", { name: "Message" }).fill(text);
  await assistant(page).getByRole("button", { name: "Send" }).click();
}

/** A sample group with two Ravi Kumars (1955 and 1980), open on its Cruz sheet with the assistant. */
async function groupWithTwoRavis(page: Page, signIn: SignIn, sampleGroup: SampleGroup, database: Parameters<typeof applyGroupChanges>[0]) {
  const owner = await signIn(page, "Carla Cruz");
  const group = await sampleGroup(owner);
  await applyGroupChanges(database, group.groupId, owner.id, [
    { op: "createPerson", tempId: "new:a", name: "Ravi Kumar", gender: "male", birthYear: 1955 },
    { op: "createPerson", tempId: "new:b", name: "Ravi Kumar", gender: "male", birthYear: 1980 },
  ]);
  await page.goto(`/g/${group.groupId}/s/${group.cruzSheet}`);
  await expect(cards(page)).toHaveCount(36);
  await page.getByRole("button", { name: "Ask AI" }).click();
  await expect(assistant(page)).toBeVisible();
  return group;
}

/** "Priya Sharma married Ravi" → which Ravi? → "1980" → a proposal card. */
async function proposePriya(page: Page) {
  await ask(page, "Priya Sharma married Ravi");
  await expect(conversation(page)).toContainText("Which one do you mean: Ravi Kumar (born 1955) or Ravi Kumar (born 1980)?");
  await ask(page, "1980");
  const card = assistant(page).getByRole("region", { name: "Proposed changes" });
  await expect(card.getByRole("listitem")).toHaveText([
    "Add Priya Sharma (female)",
    "Priya Sharma and Ravi Kumar (1980) are married",
    'New sheet "Priya Sharma\'s family" about Priya Sharma',
  ]);
  return card;
}

test("Priya married Ravi: which Ravi? → a proposal → Confirm → Priya and her sheet appear", async ({ page, signIn, sampleGroup, database }) => {
  const { cruzSheet } = await groupWithTwoRavis(page, signIn, sampleGroup, database);
  const card = await proposePriya(page);
  await expect(conversation(page)).toContainText("Please check them on the card and confirm.");
  await page.screenshot({ path: "test-results/screenshots/chat.png" });
  await expect(page.getByRole("tab", { name: "Priya Sharma's family" })).toHaveCount(0); // nothing saved yet

  await card.getByRole("button", { name: "Confirm" }).click();
  await expect(conversation(page)).toContainText("Saved.");
  await expect(card).toHaveCount(0);
  await page.getByRole("tab", { name: "Priya Sharma's family" }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.getByRole("tabpanel").getByRole("button", { name: /^Priya Sharma$/ })).toBeVisible();
  await expect(page.getByRole("tabpanel").getByRole("button", { name: /^Ravi Kumar, 1980$/ })).toBeVisible();

  // The conversation goes on, with the model told what was saved; the stand-in, like the API, refuses
  // a conversation that was edited, so this reply also shows nothing earlier changed.
  await ask(page, "Thanks!");
  await expect(conversation(page)).toContainText("I can help with your family tree.");

  const mine = (await stubCalls()).filter((c) => c.notes.some((n) => n.includes(cruzSheet)));
  expect(mine[0]).toMatchObject({ lastQuestion: "Priya Sharma married Ravi", tools: expect.arrayContaining(["add_person", "create_sheet"]) });
  expect(mine[0].tools).toHaveLength(8);
  expect(mine[0].notes[0]).toContain("The user can propose changes");
  expect(mine[0].notes[0]).toContain('"Ravi Kumar" | male | 1980');
  expect(mine.at(-1)!.notes.at(-1)).toMatch(/^The user confirmed the proposal and it was saved\. new:1 is now [a-f\d]{24}/);
});

test("Discard drops the proposal and changes nothing", async ({ page, signIn, sampleGroup, database }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await groupWithTwoRavis(page, signIn, sampleGroup, database);
  const card = await proposePriya(page);
  await page.screenshot({ path: "test-results/screenshots/night-chat.png" });
  await card.getByRole("button", { name: "Discard" }).click();
  await expect(conversation(page)).toContainText("Discarded.");
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(cards(page)).toHaveCount(36);
  await expect(page.getByRole("tab", { name: "Priya Sharma's family" })).toHaveCount(0);
});

test("a Viewer's assistant gets the read tools only", async ({ browser, page, signIn, sampleGroup, addMember }) => {
  const owner = await signIn(page, "Carla Cruz");
  const { groupId, cruzSheet } = await sampleGroup(owner);
  const viewerPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    const viewer = await signIn(viewerPage, "Vera Viewer");
    await addMember(groupId, viewer, "view");
    await viewerPage.goto(`/g/${groupId}/s/${cruzSheet}`);
    await viewerPage.getByRole("button", { name: "Ask AI" }).click();
    await ask(viewerPage, "Who is Jake Cruz?");
    await expect(conversation(viewerPage)).toContainText("Jake Cruz was born in 1945.");

    const call = (await stubCalls()).find((c) => c.lastQuestion === "Who is Jake Cruz?" && c.notes.some((n) => n.includes(cruzSheet)))!;
    expect(call.tools).toEqual(["search_people", "get_person"]);
    expect(call.notes[0]).toContain("view-only access");
  } finally {
    await viewerPage.context().close();
  }
});
