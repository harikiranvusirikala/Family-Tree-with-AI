import { expect, test } from "./fixtures";

// The site stats (an owner request, 2026-10-25): only SITE_ADMIN_EMAILS sees them; playwright.config.ts
// gives the e2e server one address per run.
const adminEmail = process.env.E2E_SITE_ADMIN_EMAIL!;

test("the site's owner opens Site stats from the account menu and sees counts, never names", async ({ page, signIn, sampleGroup }) => {
  const admin = await signIn(page, "Site Owner", { email: adminEmail });
  await sampleGroup(admin);
  await page.goto("/dashboard");

  await page.getByRole("banner").getByRole("button", { name: admin.name }).click();
  await page.getByRole("menu", { name: "Account" }).getByRole("menuitem", { name: "Site stats" }).click();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { name: "Site stats" })).toBeVisible();

  // The whole run's database: at least this user, their group and the sample family's 36 people.
  const totals = page.getByRole("region", { name: "Totals", exact: true });
  await expect(totals).toBeVisible();
  expect(Number((await page.getByTestId("total-people").textContent())!.replace(/\D/g, ""))).toBeGreaterThanOrEqual(36);
  expect(Number((await page.getByTestId("total-users").textContent())!.replace(/\D/g, ""))).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("total-photos-note")).toHaveText(/^from \d+ uploads?$/); // pictures, and the uploads they come from
  for (const name of ["Active people", "Building", "New users per week", "New groups per week", "Assistant", "Sharing", "Groups"]) {
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("list", { name: "Assistant messages per day" }).getByRole("listitem")).toHaveCount(30);
  await expect(page.getByTestId("group-row").first()).toBeVisible();
  // Counts only: no group names or family names anywhere on the page.
  const text = (await page.getByRole("main").textContent()) ?? "";
  expect(text).not.toContain("Cruz");
  expect(text).not.toContain("Willow");
  await page.screenshot({ path: "test-results/screenshots/admin.png", fullPage: true, animations: "disabled" });

  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("heading", { name: "Site stats" })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/night-admin.png", fullPage: true, animations: "disabled" });
});

test("anyone else has no Site stats in the menu, and /admin looks like a page that doesn't exist", async ({ page, signIn }) => {
  const user = await signIn(page, "Ada Lovelace");
  await page.goto("/dashboard");
  await page.getByRole("banner").getByRole("button", { name: user.name }).click();
  const account = page.getByRole("menu", { name: "Account" });
  await expect(account.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await expect(account.getByRole("menuitem", { name: "Site stats" })).toHaveCount(0);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "This page isn't here" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Site stats" })).toHaveCount(0);
});

test("signed out, /admin asks to sign in like any private page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/\?returnTo=%2Fadmin$/);
});
