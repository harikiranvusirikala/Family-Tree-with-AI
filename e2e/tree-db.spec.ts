import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });

test("the seeded family renders from the database, sheet by sheet", async ({ page }) => {
  await page.goto("/dev/tree/db");
  // Cruz family: rooted at Alexander Cruz, with the 4 in-law parents as extras.
  await expect(page.getByTestId("person-card")).toHaveCount(36);
  await page.waitForTimeout(300); // let fitView settle
  await page.screenshot({ path: "test-results/screenshots/tree-db.png" });

  // Jerry Willow's in-law sheet: his parents, not Alexander's.
  await page.getByRole("button", { name: "Jerry Willow's family" }).click();
  await expect(page.getByTestId("person-card")).toHaveCount(32);
  await expect(page.getByTestId("person-card").filter({ hasText: "Cynthia Willow" })).toBeVisible();
  await expect(page.getByTestId("person-card").filter({ hasText: "Amy Harolds" })).toHaveCount(0);
});
