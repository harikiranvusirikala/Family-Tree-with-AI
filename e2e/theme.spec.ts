import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

test.use({ viewport: { width: 1600, height: 1000 } });

/** How light a CSS colour is, 0 (black) to 1 (white). The browser draws it, so any colour syntax works. */
async function lightness(locator: Locator, property: "color" | "backgroundColor") {
  return locator.evaluate((element, prop) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.fillStyle = getComputedStyle(element)[prop];
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }, property);
}

const html = (page: Page) => page.locator("html");
const cardName = (page: Page, name: string) => page.getByRole("tabpanel").getByTestId("person-card").getByText(name, { exact: true });
const screenshot = (page: Page, name: string) => page.screenshot({ path: `test-results/screenshots/night-${name}.png` });

test("day, night or follow the device: the choice stays, and the tree is readable at night", async ({ page, signIn, sampleGroup }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: "dark" });
  const owner = await signIn(page, "Nora Night");
  const { groupId, cruzSheet } = await sampleGroup(owner);

  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await expect(html(page)).toHaveClass(/\bdark\b/); // the device says night, and nothing was chosen
  await expect(page.locator(".react-flow")).toHaveClass(/\bdark\b/);
  await expect(cardName(page, "Jake Cruz")).toBeVisible();
  expect(await lightness(cardName(page, "Jake Cruz"), "color")).toBeGreaterThan(0.8); // light names...
  expect(await lightness(page.locator(".react-flow"), "backgroundColor")).toBeLessThan(0.15); // ...on a dark canvas
  await page.getByRole("tabpanel").getByRole("button", { name: /^Jerry Willow,/ }).click();
  await expect(page.getByRole("complementary", { name: "Person details" }).getByRole("button", { name: "Go to Jerry Willow's family" })).toBeVisible();
  await screenshot(page, "tree");
  await page.goto(`/g/${groupId}/s/everyone?view=list`); // ★ Everyone's List
  await expect(page.getByRole("table", { name: "People" }).locator("tbody tr")).toHaveCount(36);
  await screenshot(page, "everyone-list");
  await page.goto(`/g/${groupId}/s/everyone?view=network`); // and its Network
  await expect(page.getByRole("tabpanel").getByTestId("network-person")).toHaveCount(36);
  await page.waitForTimeout(300);
  await screenshot(page, "everyone-network");
  await page.goto(`/g/${groupId}/s/everyone?view=wheel`); // and its Wheel
  await expect(page.getByRole("tabpanel").getByTestId("wheel-person")).toHaveCount(36);
  await page.waitForTimeout(500);
  await screenshot(page, "everyone-wheel");

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome, Nora Night" })).toBeVisible(); // not the loading text
  await screenshot(page, "dashboard");
  await page.goto(`/g/${groupId}/members`);
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  await screenshot(page, "members");

  const choice = (label: string) => page.getByRole("group", { name: "Theme" }).getByRole("button", { name: label });
  await expect(choice("Follow device")).toHaveAttribute("aria-pressed", "true");

  // Day wins over the device, also after a reload.
  await choice("Day theme").click();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await expect(choice("Day theme")).toHaveAttribute("aria-pressed", "true");
  await page.goto(`/g/${groupId}/s/${cruzSheet}`);
  await expect(cardName(page, "Jake Cruz")).toBeVisible();
  expect(await lightness(cardName(page, "Jake Cruz"), "color")).toBeLessThan(0.2);
  await page.screenshot({ path: "test-results/screenshots/day-tree.png" }); // the sheets page as people see it by day

  // Night stays night when the device turns to day.
  await choice("Night theme").click();
  await expect(html(page)).toHaveClass(/\bdark\b/);
  expect(await lightness(cardName(page, "Jake Cruz"), "color")).toBeGreaterThan(0.8);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).toHaveClass(/\bdark\b/);

  // Follow device: day now, then night as soon as the device changes, with no reload.
  await choice("Follow device").click();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await expect(choice("Follow device")).toHaveAttribute("aria-pressed", "true");
  expect(hydrationErrors).toEqual([]);
});

test("the sign-in page has the switch too", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await page.screenshot({ path: "test-results/screenshots/day-sign-in.png" });
  await page.getByRole("button", { name: "Night theme" }).click();
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await screenshot(page, "sign-in");
});
