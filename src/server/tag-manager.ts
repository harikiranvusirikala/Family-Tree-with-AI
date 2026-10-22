// Google Tag Manager, on the landing page only (an owner request, 2026-10-22). Pure, like
// security-headers.ts: next.config.ts (the landing page's policy) and the landing page (Google's
// snippets) both read the ID here, so the page loads Tag Manager exactly when its policy allows it.

export interface TagManagerEnv {
  /**
   * The owner's container, e.g. GTM-KZDLK4PQ. Set in Vercel's Production only: previews, local runs
   * and tests never load Tag Manager, and copies of the app don't send their visitors to the owner's account.
   */
  GTM_ID?: string;
}

/**
 * GTM_ID if it is a container ID ("GTM-", then capital letters and digits), otherwise nothing, so a
 * typo can't put other text into the page's script. Read when the site is built, like the headers:
 * the landing page is prerendered.
 */
export function gtmId(env: TagManagerEnv): string | undefined {
  const id = env.GTM_ID?.trim();
  return id && /^GTM-[A-Z0-9]+$/.test(id) ? id : undefined;
}
