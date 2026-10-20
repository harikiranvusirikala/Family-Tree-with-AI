import type { ReactNode } from "react";
import Link from "next/link";
import { UserMenu, type HeaderLink } from "./auth/UserMenu";
import { ThemeToggle } from "./ThemeToggle";

export type { HeaderLink };

/**
 * The bar on signed-in pages: home link, the page's own items (the group's name), its links, the
 * day/night switch and the user menu. On phones the links and the switch move into the user menu, so
 * the group's name has room (an owner request after the final check).
 */
export function AppHeader({ user, children, links = [] }: { user: { name: string; email: string }; children?: ReactNode; links?: HeaderLink[] }) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 md:gap-4 md:px-4 dark:border-zinc-800">
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <Link href="/dashboard" className="shrink-0 text-lg font-semibold tracking-tight">
          Family Tree
        </Link>
        {children}
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-label={link.ariaLabel} className="hidden shrink-0 text-sm text-zinc-600 underline md:inline dark:text-zinc-400">
            {link.label}
            {!!link.badge && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 no-underline dark:bg-amber-900/60 dark:text-amber-100">{link.badge}</span>}
          </Link>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <UserMenu user={{ name: user.name, email: user.email }} links={links} />
      </div>
    </header>
  );
}
