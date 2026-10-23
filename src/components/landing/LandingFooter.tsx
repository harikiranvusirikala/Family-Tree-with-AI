import type { ReactNode } from "react";
import { SUPPORT_URL } from "@/components/support";
import { SOURCE_URL } from "./content";
import { GitHubMark } from "@/components/ui/icons";
import { Logo, PAGE_LINKS, pageLink } from "./LandingHeader";

/** Links to other sites open in a new tab, and say so (CLAUDE.md, step 11's hardening). */
const external = { target: "_blank", rel: "noopener noreferrer" } as const;

function LinkColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">{children}</ul>
    </nav>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Build your family tree together, with an AI assistant. Free, and open source under the MIT license.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:gap-20">
          <LinkColumn title="On this page">
            {PAGE_LINKS.map(({ href, label }) => (
              <li key={href}>
                <a href={href} className={pageLink}>
                  {label}
                </a>
              </li>
            ))}
          </LinkColumn>
          <LinkColumn title="Project">
            <li>
              <a href={SOURCE_URL} {...external} aria-label="Source code on GitHub (opens in a new tab)" className={`${pageLink} gap-1.5`}>
                <GitHubMark className="size-4" />
                Source code
              </a>
            </li>
            <li>
              <a href={`${SOURCE_URL}/blob/main/LICENSE`} {...external} aria-label="MIT license (opens in a new tab)" className={pageLink}>
                MIT license
              </a>
            </li>
            <li>
              <a href={SUPPORT_URL} {...external} aria-label="Buy me a coffee (opens in a new tab)" className={`${pageLink} gap-1`}>
                Buy me a coffee<span aria-hidden>☕</span>
              </a>
            </li>
          </LinkColumn>
        </div>
      </div>
    </footer>
  );
}
