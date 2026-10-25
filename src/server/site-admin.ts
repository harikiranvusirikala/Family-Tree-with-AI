import { normalizeEmail } from "./members-rules";

/**
 * The site's owners, who may open the site stats at /admin (an owner request, 2026-10-25): the
 * comma-separated `SITE_ADMIN_EMAILS`, compared like invites (gmail dots and +tags ignored). Without
 * it, nobody. Read on the server only; the browser only ever learns yes or no.
 */
export function isSiteAdmin(email: string, env: Record<string, string | undefined> = process.env): boolean {
  const admins = (env.SITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean)
    .map(normalizeEmail);
  return !!email.trim() && admins.includes(normalizeEmail(email));
}
