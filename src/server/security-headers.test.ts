// @vitest-environment node
import { describe, expect, test } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

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
