// What src/proxy.ts does with a request, decided from the request alone (no database read).
// A convenience, not security: pages, server actions and routes still check for themselves (§8).

export interface ProxyRequest {
  pathname: string;
  search: string; // "" or "?…"
  method: string;
  hasSessionCookie: boolean;
}

export type ProxyDecision =
  | { action: "continue" }
  | { action: "sign-in"; location: string } // a 307 to the landing page, keeping the link
  | { action: "unauthorized" }; // 401

// Deny by default: everything else needs a session cookie, so new pages are covered without being listed.
const PUBLIC_PATHS = [
  /^\/$/, // landing page and sign-in
  /^\/api\/auth(\/|$)/, // Better Auth; the Google callback arrives without a session
  /^\/dev(\/|$)/, // developer pages, themselves 404 outside `next dev` and e2e builds
  /^\/_next\//,
  /\.(?:ico|png|jpe?g|gif|svg|webp|avif|txt|xml|webmanifest)$/i, // static files
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

export function proxyDecision({ pathname, search, method, hasSessionCookie }: ProxyRequest): ProxyDecision {
  // Never redirect *because* a cookie is present: a stale cookie would then bounce between pages.
  if (hasSessionCookie || isPublicPath(pathname)) return { action: "continue" };

  const isPageLoad = (method === "GET" || method === "HEAD") && !pathname.startsWith("/api/");
  if (!isPageLoad) return { action: "unauthorized" };

  const query = new URLSearchParams(search);
  query.delete("_rsc"); // Next.js's internal cache-busting parameter
  const returnTo = pathname + (query.size ? `?${query}` : "");
  return { action: "sign-in", location: `/?${new URLSearchParams({ returnTo })}` };
}
