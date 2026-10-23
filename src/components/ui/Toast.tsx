"use client";

import type { ReactNode } from "react";

/**
 * A short message that floats in and goes (the production look): "Saved.", "Jake Cruz deleted." with
 * Undo. A status, so screen readers say it; placed by its parent (`className`), it slides in unless the
 * device asks for less motion.
 */
export function Toast({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`pointer-events-none flex justify-center ${className}`}>
      <div
        role="status"
        className="pointer-events-auto flex animate-menu-in items-center gap-3 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg shadow-zinc-900/20 motion-reduce:animate-none dark:bg-white dark:text-zinc-900 dark:shadow-black/40"
      >
        {children}
      </div>
    </div>
  );
}

/** A toast's action (Undo): light on the dark toast. */
export const toastAction =
  "rounded-md px-1.5 py-0.5 font-semibold text-sky-300 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-60 pointer-coarse:min-h-11 dark:text-sky-700 dark:hover:bg-zinc-900/10 dark:focus-visible:ring-sky-700";
