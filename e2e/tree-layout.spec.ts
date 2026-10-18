import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });

test("the whole sample family renders; a screenshot is saved for comparing with the sample image", async ({ page }) => {
  await page.goto("/dev/tree");
  await expect(page.getByTestId("person-card")).toHaveCount(36);
  await expect(page.getByText("Living").or(page.getByText("Present"))).toHaveCount(0);
  await page.waitForTimeout(300); // let fitView settle
  await page.screenshot({ path: "test-results/screenshots/tree.png" });
});

test("adding a child lays the tree out again", async ({ page }) => {
  await page.goto("/dev/tree");
  await expect(page.getByTestId("person-card")).toHaveCount(36);
  await page.getByRole("button", { name: "Add a child to Jane & William" }).click();
  await expect(page.getByTestId("person-card")).toHaveCount(37);
  await expect(page.locator('[data-person-id="baby-1"]')).toBeVisible();
});
