import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

/**
 * Loads every picture on the page now, lazy ones too (the landing page's are lazy below the top), and
 * checks they all arrived: a full-page screenshot doesn't scroll, so it would show empty frames.
 */
export async function loadEveryPicture(page: Page) {
  await page.evaluate(() => document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((image) => (image.loading = "eager")));
  await expect
    .poll(() => page.evaluate(() => [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src)))
    .toEqual([]);
}
