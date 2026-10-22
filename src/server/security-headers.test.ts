// @vitest-environment node
import { describe, expect, test } from "vitest";
import { contentSecurityPolicy, headerRules, securityHeaders } from "./security-headers";

const directives = (policy: string) => Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("security headers (step 11)", () => {
  test("production: the site itself, plus Cloudinary for photos and uploads; no plugins, no framing", () => {
    expect(directives(contentSecurityPolicy({ NODE_ENV: "production" }))).toEqual({
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
      "font-src": ["'self'"],
      "connect-src": ["'self'", "https://api.cloudinary.com", "https://res.cloudinary.com"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
    });
  });

  test("eval only under next dev; the e2e stand-in's address replaces Cloudinary's API", () => {
    expect(directives(contentSecurityPolicy({ NODE_ENV: "development" }))["script-src"]).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
    expect(directives(contentSecurityPolicy({ NODE_ENV: "production", CLOUDINARY_API_URL: "http://localhost:3101/" }))["connect-src"]).toEqual([
      "'self'",
      "http://localhost:3101",
      "https://res.cloudinary.com",
    ]);
  });

  test("the other headers", () => {
    expect(Object.fromEntries(securityHeaders({}).map(({ key, value }) => [key, value]))).toEqual({
      "Content-Security-Policy": contentSecurityPolicy({}),
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
  });
});

describe("Google Tag Manager on the landing page only (owner request)", () => {
  const production = { NODE_ENV: "production" };

  test("without a valid GTM_ID: one rule, today's headers on every address", () => {
    for (const GTM_ID of [undefined, "", "GTM-bad id"]) {
      expect(headerRules({ ...production, GTM_ID }), String(GTM_ID)).toEqual([{ source: "/(.*)", headers: securityHeaders(production) }]);
    }
  });

  test("with GTM_ID: every address keeps today's headers, and a later rule gives the landing page Google's sources", () => {
    const rules = headerRules({ ...production, GTM_ID: "GTM-KZDLK4PQ" });
    expect(rules).toEqual([
      { source: "/(.*)", headers: securityHeaders(production) },
      { source: "/", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy(production, { tagManager: true }) }] },
    ]);
    expect(directives(rules[1].headers[0].value)).toEqual({
      ...directives(contentSecurityPolicy(production)),
      "script-src": ["'self'", "'unsafe-inline'", "https://*.googletagmanager.com"],
      "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.google-analytics.com", "https://*.googletagmanager.com"],
      "connect-src": [
        "'self'",
        "https://api.cloudinary.com",
        "https://res.cloudinary.com",
        "https://*.google-analytics.com",
        "https://*.analytics.google.com",
        "https://*.googletagmanager.com",
      ],
      // Frames followed default-src ('self') until now; the frame is for visitors without JavaScript.
      "frame-src": ["'self'", "https://www.googletagmanager.com"],
    });
  });

  test("the e2e build's settings (playwright.config.ts clears GTM_ID): nothing from Google anywhere", () => {
    const rules = headerRules({ NODE_ENV: "production", CLOUDINARY_API_URL: "http://localhost:3101", GTM_ID: "" });
    expect(rules).toHaveLength(1);
    expect(JSON.stringify(rules)).not.toMatch(/google/i);
  });
});
