import { expect, test } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Family Tree");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Family Tree");
});
