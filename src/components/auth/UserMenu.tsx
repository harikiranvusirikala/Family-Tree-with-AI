"use client";

import { useEffect, useRef, useState } from "react";
import { initials } from "../initials";
import { useHydrated } from "../use-hydrated";
import { authClient } from "./auth-client";

/**
 * The signed-in user's initials and name, opening a menu with Sign out. The Google photo isn't shown:
 * next/image would need remotePatterns and use Vercel's image quota.
 */
export function UserMenu({ user }: { user: { name: string; email: string } }) {
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

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!hydrated}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
          {initials(name)}
        </span>
        <span className="text-sm font-medium">{name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-900 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          <p className="truncate px-2 py-1 text-sm text-zinc-500 dark:text-zinc-400">{email}</p>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={signingOut}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-800"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {failed && <p role="alert" className="px-2 py-1 text-sm text-red-700 dark:text-red-400">Couldn&apos;t sign out. Please try again.</p>}
        </div>
      )}
    </div>
  );
}
