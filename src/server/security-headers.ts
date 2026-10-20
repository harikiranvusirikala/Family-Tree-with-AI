// Security headers on every response (step 11, §11), set in next.config.ts. One fixed policy, built
// at build time: inline scripts are allowed because Next.js writes each page's data into inline
// scripts, as does the theme script; nonces would need every page drawn per request (decided in step 11).

export interface HeaderEnv {
  NODE_ENV?: string;
  /** The e2e stand-in for Cloudinary's API; Cloudinary itself otherwise. */
  CLOUDINARY_API_URL?: string;
}

const PHOTOS = "https://res.cloudinary.com";

export function contentSecurityPolicy(env: HeaderEnv): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React's debugging uses eval in `next dev` only.
    "script-src": ["'self'", "'unsafe-inline'", ...(env.NODE_ENV === "development" ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"], // style attributes: React Flow places every card with one
    "img-src": ["'self'", "data:", "blob:", PHOTOS], // data: and blob: for the picture export
    "font-src": ["'self'"],
    // Photo uploads go straight to Cloudinary; the picture export fetches the photos it draws.
    "connect-src": ["'self'", new URL(env.CLOUDINARY_API_URL || "https://api.cloudinary.com").origin, PHOTOS],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
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
