import type { Page } from "@playwright/test";

const watched = new WeakSet<Page>();

/**
 * Collects the Content Security Policy violations the browser reports on `page` into `into` (Chrome
 * logs each as a console error, "Refused to … because it violates the following Content Security
 * Policy directive"). Used by every e2e test (fixtures.ts) and the production smoke test.
 */
export function watchPolicyViolations(page: Page, into: string[]): string[] {
  if (watched.has(page)) return into;
  watched.add(page);
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) into.push(message.text());
  });
  return into;
}
