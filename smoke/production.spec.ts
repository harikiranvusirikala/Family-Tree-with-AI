import { expect, test } from "@playwright/test";
import { securityHeaders } from "@/server/security-headers";
import { watchPolicyViolations } from "../e2e/policy-violations";

// Against the live site: nothing here signs in or writes to its database.

test("the landing page: security headers, and Sign in with Google works under the policy", async ({ page, baseURL }) => {
  const violations = watchPolicyViolations(page, []);
  const response = (await page.goto("/"))!;
  const headers = await response.allHeaders();
  for (const { key, value } of securityHeaders({ NODE_ENV: "production" })) {
    // Vercel sends its own Strict-Transport-Security too; either way it's two years.
    if (key === "Strict-Transport-Security") expect(headers[key.toLowerCase()]).toContain("max-age=63072000");
    else expect(headers[key.toLowerCase()], key).toBe(value);
  }
  expect(headers["x-powered-by"]).toBeUndefined();

  // The button is enabled once the page's scripts run, so this also shows the policy lets them.
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ contentType: "text/plain", body: "Google (stub)" }));
  const google = page.waitForRequest((r) => r.url().startsWith("https://accounts.google.com/"));
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const authorize = new URL((await google).url());
  expect(authorize.searchParams.get("redirect_uri")).toBe(new URL("/api/auth/callback/google", baseURL).href);

  for (const cookie of (await page.context().cookies()).filter((c) => baseURL!.includes(c.domain.replace(/^\./, "")))) {
    expect(cookie, cookie.name).toMatchObject({ secure: true, httpOnly: true, sameSite: "Lax" });
  }
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
