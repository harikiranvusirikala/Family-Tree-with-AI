import { expect, test } from "./fixtures";

const SESSION_COOKIE = "better-auth.session_token"; // no __Secure- prefix over http

test("signed out, a page answers 307 to sign-in, keeping the link", async ({ request, baseURL }) => {
  const response = await request.get("/dashboard?tab=x", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const location = new URL(response.headers().location, baseURL);
  expect(location.pathname + location.search).toBe("/?returnTo=%2Fdashboard%3Ftab%3Dx");
});

test.describe("Sign in with Google", () => {
  test.beforeEach(async ({ page }) => {
    // Stop at Google's door: the test never contacts Google.
    await page.route("https://accounts.google.com/**", (route) => route.fulfill({ contentType: "text/plain", body: "Google (stub)" }));
  });

  test("passes the link along as the callback and goes to Google with this server's callback", async ({ page }) => {
    await page.goto("/?returnTo=%2Fdashboard%3Ftab%3Dx");
    const signIn = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/auth/sign-in/social"));
    const google = page.waitForRequest((r) => r.url().startsWith("https://accounts.google.com/"));
    await page.getByRole("button", { name: "Sign in with Google" }).click();

    expect((await signIn).postDataJSON()).toMatchObject({ provider: "google", callbackURL: "/dashboard?tab=x" });
    const authorize = new URL((await google).url());
    expect(authorize.searchParams.get("redirect_uri")).toBe("http://localhost:3100/api/auth/callback/google");
    expect(authorize.searchParams.get("prompt")).toBe("select_account");
  });

  test("an off-site returnTo becomes /dashboard", async ({ page }) => {
    await page.goto("/?returnTo=https%3A%2F%2Fevil.example");
    const signIn = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/auth/sign-in/social"));
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    expect((await signIn).postDataJSON()).toMatchObject({ callbackURL: "/dashboard" });
  });

  test("a failed sign-in comes back with a plain message", async ({ page }) => {
    await page.goto("/?returnTo=%2Fdashboard&error=access_denied");
    await expect(page.getByRole("alert").filter({ hasText: "Sign-in was cancelled." })).toBeVisible();
  });
});

test("signed in, the dashboard shows the user; Sign out leads to the landing page", async ({ page, signIn }) => {
  const user = await signIn(page, "Ada Lovelace");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: `Welcome, ${user.name}` })).toBeVisible();

  await page.getByRole("button", { name: user.name }).click();
  await expect(page.getByRole("menu")).toContainText(user.email);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  expect((await page.context().cookies()).map((c) => c.name)).not.toContain(SESSION_COOKIE);

  await page.goto("/dashboard");
  await expect(page).toHaveURL("/?returnTo=%2Fdashboard");
});

test("a garbage session cookie ends on the landing page once, with no redirect loop", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: SESSION_COOKIE, value: "garbage", url: baseURL }]);
  const loaded: string[] = []; // page loads, not the router's same-page history updates
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) loaded.push(new URL(request.url()).pathname);
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL("/");
  await page.waitForTimeout(1000); // a loop would keep navigating
  expect(loaded).toEqual(["/dashboard", "/"]);
});
