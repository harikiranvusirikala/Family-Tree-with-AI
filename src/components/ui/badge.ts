import type { Role } from "@/server/roles";

// Badges (the production look, an owner request): roles, counts, "You". Plain class strings.

export const badge = "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold";

/** Each role's colours: the Owner dark, Admin blue, Maintain pink, View grey. */
export const ROLE_BADGE: Record<Role, string> = {
  owner: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
  admin: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  maintain: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-200",
  view: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/** A count waiting for someone: access requests. */
export const countBadge = "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100";

/** Quiet: "You". */
export const quietBadge = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
