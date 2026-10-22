import { DESCRIPTION, FAQ, GOOGLE_SITE_VERIFICATION, TITLE } from "@/components/landing/content";
import { expect, test } from "./fixtures";
import { loadEveryPicture } from "./pictures";

test.use({ viewport: { width: 1440, height: 900 } });

test("the landing page tells search engines and link previews what the app is", async ({ page, request, baseURL }) => {
  const site = new URL(baseURL!).origin; // the site's address (src/server/site.ts): this run's server
  await page.goto("/");
  await expect(page).toHaveTitle(TITLE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build your family tree together, with an AI assistant");

  const head = (selector: string, attribute = "content") => page.locator(selector).getAttribute(attribute);
  expect(await head('meta[name="description"]')).toBe(DESCRIPTION);
  expect(await head('meta[name="google-site-verification"]')).toBe(GOOGLE_SITE_VERIFICATION);
  expect(await head('link[rel="canonical"]', "href")).toBe(site);
  expect(await head('meta[property="og:title"]')).toBe(TITLE);
  expect(await head('meta[property="og:description"]')).toBe(DESCRIPTION);
  expect(await head('meta[property="og:type"]')).toBe("website");
  expect(await head('meta[name="twitter:card"]')).toBe("summary_large_image");
  expect(await head('meta[property="og:image:width"]')).toBe("1200");
  expect(await head('meta[property="og:image:height"]')).toBe("630");
  expect(await head('meta[property="og:image:alt"]')).toContain("family tree");
  const previewImage = (await head('meta[property="og:image"]'))!;
  expect(previewImage.startsWith(`${site}/opengraph-image.png`)).toBe(true);

  // The preview image and the icons are there, for signed-out visitors too (no detour to sign in).
  const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  expect(icons.length).toBeGreaterThanOrEqual(3); // favicon.ico, icon.svg, apple-icon.png
  for (const address of [previewImage, ...icons]) {
    const response = await request.get(address, { maxRedirects: 0 });
    expect(response.status(), address).toBe(200);
    expect(response.headers()["content-type"], address).toMatch(/^image\//);
  }

  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  const ofType = (type: string) => data["@graph"].find((node: { "@type": string }) => node["@type"] === type);
  expect(ofType("WebSite").url).toBe(`${site}/`);
  expect(ofType("WebApplication").offers.price).toBe("0");
  expect(ofType("FAQPage").mainEntity).toHaveLength(FAQ.length);

  await loadEveryPicture(page); // the logo and every screenshot, from this site (the policy allows nothing else)
});

test("robots.txt keeps search engines out of a test build, and the sitemap lists only the landing page", async ({ request, baseURL }) => {
  const robots = await request.get("/robots.txt", { maxRedirects: 0 });
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toBe("User-Agent: *\nDisallow: /\n\n");

  const sitemap = await request.get("/sitemap.xml", { maxRedirects: 0 });
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml.match(/<loc>/g)).toHaveLength(1);
  expect(xml).toContain(`<loc>${new URL(baseURL!).origin}/</loc>`);
});

test("the header's links go to the page's parts, below the header, and a question opens with a click", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Page sections" }).getByRole("link", { name: "FAQ" }).click();
  await expect(page).toHaveURL(/#faq$/);
  const faq = page.getByRole("region", { name: "Questions and answers" });
  const heading = faq.getByRole("heading", { level: 2 });
  await expect(heading).toBeInViewport();
  expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual((await page.getByRole("banner").boundingBox())!.height);

  const { question, answer } = FAQ[1];
  await expect(faq.getByText(answer)).toBeHidden();
  await faq.getByRole("heading", { name: question }).click();
  await expect(faq.getByText(answer)).toBeVisible();
});

test("the landing page by day and by night, whole", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await loadEveryPicture(page);
  await page.screenshot({ path: "test-results/screenshots/landing.png", fullPage: true });
  await page.getByRole("button", { name: "Night theme" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.screenshot({ path: "test-results/screenshots/night-landing.png", fullPage: true });
});
