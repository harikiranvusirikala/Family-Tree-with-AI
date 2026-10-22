import { expect, test } from "@playwright/test";
import { contentSecurityPolicy, securityHeaders } from "@/server/security-headers";
import { watchPolicyViolations } from "../e2e/policy-violations";

// Against the live site: nothing here signs in or writes to its database.

const production = { NODE_ENV: "production" };

test("the landing page: security headers, and Sign in with Google works under the policy", async ({ page, baseURL, request }) => {
  const violations = watchPolicyViolations(page, []);
  // Google Tag Manager runs on the landing page when the site has GTM_ID (an owner request). Answered
  // here, so a smoke test is never counted as a visit and Google Analytics sets no cookies; the
  // browser still checks the policy before asking.
  const tagManager: string[] = [];
  await page.route("https://www.googletagmanager.com/**", (route) => {
    tagManager.push(route.request().url());
    return route.fulfill({ contentType: "text/javascript", body: "" });
  });
  const response = (await page.goto("/"))!;
  const headers = await response.allHeaders();
  // The landing page's policy also allows Tag Manager when the site has GTM_ID; a copy without it
  // keeps the strict policy.
  const strict = contentSecurityPolicy(production);
  const withTagManager = contentSecurityPolicy(production, { tagManager: true });
  expect([strict, withTagManager]).toContain(headers["content-security-policy"]);
  for (const { key, value } of securityHeaders(production)) {
    if (key === "Content-Security-Policy") continue;
    // Vercel sends its own Strict-Transport-Security too; either way it's two years.
    if (key === "Strict-Transport-Security") expect(headers[key.toLowerCase()]).toContain("max-age=63072000");
    else expect(headers[key.toLowerCase()], key).toBe(value);
  }
  expect(headers["x-powered-by"]).toBeUndefined();
  // Every other address keeps the strict policy: one of the page's scripts, for example.
  const script = (await response.text()).match(/\/_next\/static\/[^"]+\.js/)![0];
  expect((await request.get(script)).headers()["content-security-policy"], script).toBe(strict);
  // Tag Manager loads exactly when the policy allows it: both come from the build's GTM_ID.
  if (headers["content-security-policy"] === withTagManager) {
    await expect.poll(() => tagManager.some((url) => url.startsWith("https://www.googletagmanager.com/gtm.js?id=GTM-"))).toBe(true);
  }

  // The button is enabled once the page's scripts run, so this also shows the policy lets them.
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ contentType: "text/plain", body: "Google (stub)" }));
  const google = page.waitForRequest((r) => r.url().startsWith("https://accounts.google.com/"));
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const authorize = new URL((await google).url());
  expect(authorize.searchParams.get("redirect_uri")).toBe(new URL("/api/auth/callback/google", baseURL).href);

  for (const cookie of (await page.context().cookies()).filter((c) => baseURL!.includes(c.domain.replace(/^\./, "")))) {
    expect(cookie, cookie.name).toMatchObject({ secure: true, httpOnly: true, sameSite: "Lax" });
  }
  if (headers["content-security-policy"] === strict) expect(tagManager).toEqual([]);
  expect(violations).toEqual([]);
});

test("signed out: pages send you to sign in, the API refuses, developer pages don't exist", async ({ request, baseURL }) => {
  const dashboard = await request.get("/dashboard", { maxRedirects: 0 });
  expect(dashboard.status()).toBe(307);
  const location = new URL(dashboard.headers().location, baseURL);
  expect(location.pathname + location.search).toBe("/?returnTo=%2Fdashboard");

  expect((await request.post("/api/chat", { data: {} })).status()).toBe(401);
  expect((await request.get(`/api/groups/${"0".repeat(24)}/export?format=json`)).status()).toBe(401);
  expect((await request.get("/dev/tree")).status()).toBe(404);
});

test("search engines: robots.txt lets them read the landing page, the sitemap lists it, and link previews have their picture", async ({ request, page, baseURL }) => {
  const site = new URL(baseURL!).origin;
  const robots = await request.get("/robots.txt", { maxRedirects: 0 });
  expect(robots.status()).toBe(200);
  const rules = await robots.text();
  expect(rules).toContain("Allow: /\n");
  for (const path of ["/api/", "/dashboard", "/g/", "/invite/"]) expect(rules).toContain(`Disallow: ${path}\n`);
  expect(rules).toContain(`Sitemap: ${site}/sitemap.xml`);
  expect(await (await request.get("/sitemap.xml", { maxRedirects: 0 })).text()).toContain(`<loc>${site}/</loc>`);

  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", site);
  const previewImage = (await page.locator('meta[property="og:image"]').getAttribute("content"))!;
  expect(previewImage.startsWith(`${site}/`)).toBe(true);
  const response = await request.get(previewImage, { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});
