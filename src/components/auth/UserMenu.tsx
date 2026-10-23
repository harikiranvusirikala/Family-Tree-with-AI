"use client";

import { useState } from "react";
import Link from "next/link";
import { SUPPORT_URL } from "../support";
import { ThemeToggle } from "../ThemeToggle";
import { Avatar } from "../ui/Avatar";
import { LineIcon, type IconName } from "../ui/icons";
import { Menu, MenuSeparator, menuItem } from "../ui/Menu";
import { useHydrated } from "../use-hydrated";
import { authClient } from "./auth-client";

/** One of the group's pages (Tree, Members, Settings). `badge`: a count beside it (waiting requests). */
export interface HeaderLink {
  href: string;
  label: string;
  icon: IconName;
  ariaLabel?: string;
  badge?: number;
}

/**
 * The signed-in user's initials, opening their name and email, Buy me a coffee (a new tab) and Sign
 * out. The Google photo isn't shown: next/image would need remotePatterns and use Vercel's image
 * quota. On phones the menu also holds the group's pages and the day/night switch, and the initials
 * carry the pages' badge. The button's name is the user's name (shown to screen readers only).
 */
export function UserMenu({ user, links = [] }: { user: { name: string; email: string }; links?: HeaderLink[] }) {
  const hydrated = useHydrated();
  // Calls /api/auth/get-session, which extends the session while the user is active (permissions.ts).
  const session = authClient.useSession();
  const { name, email } = session.data?.user ?? user;
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

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
    <Menu
      label="Account"
      disabled={!hydrated}
      menuClassName="w-64"
      buttonClassName="relative flex items-center rounded-full p-0.5 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500/70 aria-expanded:bg-zinc-100 pointer-coarse:p-1.5 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800"
      button={
        <>
          <Avatar name={name} />
          <span className="sr-only">{name}</span>
          {badge > 0 && (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-amber-950 md:hidden">
              {badge}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">{email}</p>
          </div>
          <MenuSeparator />
          {links.length > 0 && (
            <div className="md:hidden">
              {links.map((link) => (
                <Link key={link.href} href={link.href} role="menuitem" aria-label={link.ariaLabel} onClick={close} className={menuItem}>
                  <LineIcon name={link.icon} className="size-4 shrink-0" />
                  <span className="flex-1">{link.label}</span>
                  {!!link.badge && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{link.badge}</span>
                  )}
                </Link>
              ))}
              <MenuSeparator />
            </div>
          )}
          <div className="flex items-center justify-between px-2.5 py-1.5 text-sm text-zinc-700 md:hidden dark:text-zinc-300">
            Theme
            <ThemeToggle />
          </div>
          <div className="md:hidden">
            <MenuSeparator />
          </div>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            aria-label="Buy me a coffee (opens in a new tab)"
            onClick={close}
            className={menuItem}
          >
            <LineIcon name="coffee" className="size-4 shrink-0" />
            Buy me a coffee
          </a>
          <button type="button" role="menuitem" onClick={signOut} disabled={signingOut} className={menuItem}>
            <LineIcon name="logOut" className="size-4 shrink-0" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {failed && (
            <p role="alert" className="px-2.5 py-1 text-sm text-red-700 dark:text-red-400">
              Couldn&apos;t sign out. Please try again.
            </p>
          )}
        </>
      )}
    </Menu>
  );
}
