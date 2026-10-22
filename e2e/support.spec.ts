import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const SUPPORT_URL = "https://buymeacoffee.com/harikiranvusirikala";

// Answer Buy Me a Coffee's page here: the test never contacts it.
async function stubSupportPage(context: BrowserContext) {
  await context.route("https://buymeacoffee.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Buy Me a Coffee (stub)</title>" }));
}

/** Clicks the link and checks it opened the page in a new tab that can't reach back to the app. */
async function opensSupportPage(page: Page, click: () => Promise<void>) {
  const popup = page.waitForEvent("popup");
  await click();
  const tab = await popup;
  await expect(tab).toHaveURL(SUPPORT_URL);
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await tab.close();
}

test("the landing page's Buy me a coffee opens the owner's page in a new tab", async ({ page, context }) => {
  await stubSupportPage(context);
  await page.goto("/");
  await opensSupportPage(page, () => page.getByRole("link", { name: "Buy me a coffee (opens in a new tab)" }).click());
  await expect(page).toHaveURL("/");
});

test("the user menu's Buy me a coffee opens the owner's page in a new tab and closes the menu", async ({ page, context, signIn }) => {
  await stubSupportPage(context);
  const user = await signIn(page, "Ada Lovelace");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: user.name }).click();
  await opensSupportPage(page, () => page.getByRole("menuitem", { name: "Buy me a coffee (opens in a new tab)" }).click());
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page).toHaveURL("/dashboard");
});
