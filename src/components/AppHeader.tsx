import type { ReactNode } from "react";
import Link from "next/link";
import { UserMenu } from "./auth/UserMenu";
import { ThemeToggle } from "./ThemeToggle";

/** The bar on signed-in pages: home link, the page's own items, the day/night switch and the user menu. */
export function AppHeader({ user, children }: { user: { name: string; email: string }; children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/dashboard" className="shrink-0 text-lg font-semibold tracking-tight">
          Family Tree
        </Link>
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <UserMenu user={{ name: user.name, email: user.email }} />
      </div>
    </header>
  );
}
