"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { initials } from "../initials";
import { ThemeToggle } from "../ThemeToggle";
import { useHydrated } from "../use-hydrated";
import { authClient } from "./auth-client";

/** A link in the header (Members, Settings). `badge`: a count shown next to it (waiting requests). */
export interface HeaderLink {
  href: string;
  label: string;
  ariaLabel?: string;
  badge?: number;
}

const menuItem = "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 pointer-coarse:min-h-11 dark:hover:bg-zinc-800";

/**
 * The signed-in user's initials and name, opening a menu with Sign out. The Google photo isn't shown:
 * next/image would need remotePatterns and use Vercel's image quota. On phones the menu also holds the
 * header's links and the day/night switch, and the initials carry the links' badge; the name shows
 * from 1024 px (screen readers always get it).
 */
export function UserMenu({ user, links = [] }: { user: { name: string; email: string }; links?: HeaderLink[] }) {
  const hydrated = useHydrated();
  // Calls /api/auth/get-session, which extends the session while the user is active (permissions.ts).
  const session = authClient.useSession();
  const { name, email } = session.data?.user ?? user;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    setFailed(false);
    const { error } = await authClient.signOut();
    if (error) {
      setSigningOut(false);
      setFailed(true);
      return;
    }
    // A full page load, so no signed-in page stays in the router cache; replace() also keeps it out of Back.
    window.location.replace("/");
  }

  const badge = links.reduce((sum, link) => sum + (link.badge ?? 0), 0);

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!hydrated}
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-2 rounded-full p-1 hover:bg-zinc-100 lg:pr-3 pointer-coarse:p-1.5 dark:hover:bg-zinc-800"
      >
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
          {initials(name)}
        </span>
        <span className="sr-only text-sm font-medium lg:not-sr-only">{name}</span>
        {badge > 0 && (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-amber-950 md:hidden">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-lg border border-zinc-200 bg-white p-2 text-zinc-900 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          <p className="truncate px-2 py-1 text-sm text-zinc-500 dark:text-zinc-400">{email}</p>
          <div className="md:hidden">
            {links.map((link) => (
              <Link key={link.href} href={link.href} role="menuitem" aria-label={link.ariaLabel} onClick={() => setOpen(false)} className={menuItem}>
                {link.label}
                {!!link.badge && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{link.badge}</span>}
              </Link>
            ))}
            <div className="flex items-center justify-between px-2 py-1.5 text-sm">
              Theme
              <ThemeToggle />
            </div>
          </div>
          <button type="button" role="menuitem" onClick={signOut} disabled={signingOut} className={`${menuItem} disabled:opacity-60`}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {failed && <p role="alert" className="px-2 py-1 text-sm text-red-700 dark:text-red-400">Couldn&apos;t sign out. Please try again.</p>}
        </div>
      )}
    </div>
  );
}
