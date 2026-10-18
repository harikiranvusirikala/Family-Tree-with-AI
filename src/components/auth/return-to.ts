const FALLBACK = "/dashboard";
const BASE = "http://same.site";

/**
 * Where to go after signing in: a path on this site, or /dashboard. Anything that could leave the
 * site (`//evil.com`, `/\evil.com`, `https://…`, `javascript:…`) is refused. Browsers drop tabs and
 * newlines from URLs, so control characters are refused too.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.includes("\\")) return FALLBACK;
  if ([...value].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return FALLBACK;
  const url = new URL(value, BASE);
  if (url.origin !== BASE || url.pathname === "/") return FALLBACK; // the landing page isn't a destination
  return value;
}
