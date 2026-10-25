// Security headers on every response (step 11, §11), set in next.config.ts. One fixed policy, built
// at build time: inline scripts are allowed because Next.js writes each page's data into inline
// scripts, as does the theme script; nonces would need every page drawn per request (decided in step 11).
// With GTM_ID set, the landing page's policy also allows Google Tag Manager (an owner request).

import { gtmId, type TagManagerEnv } from "./tag-manager";

export interface HeaderEnv extends TagManagerEnv {
  NODE_ENV?: string;
  /** The e2e stand-in for Cloudinary's API; Cloudinary itself otherwise. */
  CLOUDINARY_API_URL?: string;
}

const PHOTOS = "https://res.cloudinary.com";
// The signed-in account's Google photo in the header (googlePhotoUrl): lh3, lh4… on googleusercontent.com.
const ACCOUNT_PHOTOS = "https://*.googleusercontent.com";

// Google Tag Manager with Google Analytics 4, on the landing page only (an owner request, 2026-10-22):
// Google's sources (developers.google.com/tag-platform/security/guides/csp), and the frame its second
// snippet loads for visitors without JavaScript. Not 'unsafe-eval', which Tag Manager's custom
// JavaScript variables would need; other tags (Google Ads, the preview mode) would need more sources.
const TAG_MANAGER: Record<string, string[]> = {
  "script-src": ["https://*.googletagmanager.com"],
  "img-src": ["https://*.google-analytics.com", "https://*.googletagmanager.com"],
  "connect-src": ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"],
  "frame-src": ["https://www.googletagmanager.com"],
};

/** The policy; with `tagManager`, the landing page's, which also allows Google Tag Manager. */
export function contentSecurityPolicy(env: HeaderEnv, { tagManager = false } = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React's debugging uses eval in `next dev` only.
    "script-src": ["'self'", "'unsafe-inline'", ...(env.NODE_ENV === "development" ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"], // style attributes: React Flow places every card with one
    "img-src": ["'self'", "data:", "blob:", PHOTOS, ACCOUNT_PHOTOS], // data: and blob: for the picture export
    "font-src": ["'self'"],
    // Photo uploads go straight to Cloudinary; the picture export fetches the photos it draws.
    "connect-src": ["'self'", new URL(env.CLOUDINARY_API_URL || "https://api.cloudinary.com").origin, PHOTOS],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  if (tagManager) {
    // A directive the policy leaves out (frame-src) follows default-src: keep that, and add Google's.
    for (const [name, sources] of Object.entries(TAG_MANAGER)) directives[name] = [...(directives[name] ?? directives["default-src"]), ...sources];
  }
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

export function securityHeaders(env: HeaderEnv): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

/**
 * next.config.ts's headers(): the security headers on every address and, with a valid GTM_ID, a
 * second rule giving the landing page ("/" only) the policy that allows Google Tag Manager. When two
 * rules match an address and set the same header, Next.js and Vercel send the later one.
 */
export function headerRules(env: HeaderEnv): { source: string; headers: { key: string; value: string }[] }[] {
  const rules = [{ source: "/(.*)", headers: securityHeaders(env) }];
  if (gtmId(env)) rules.push({ source: "/", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy(env, { tagManager: true }) }] });
  return rules;
}
