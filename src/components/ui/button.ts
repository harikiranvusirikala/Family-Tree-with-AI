// The app's buttons, for <button> and <Link> alike (the production look, an owner request,
// 2026-10-23). A plain module: server components import it too.

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-zinc-950 pointer-coarse:min-h-11";

const VARIANTS = {
  primary: "bg-zinc-900 text-white shadow-sm hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
  secondary:
    "border border-zinc-300 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600",
  /** Opens a confirmation for something that can't be taken back (Leave this group…). */
  dangerOutline: "border border-red-300 bg-white text-red-700 shadow-sm hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/50",
  /** A quiet one in a row (Revoke). */
  dangerGhost: "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50",
};

const SIZES = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export type ButtonVariant = keyof typeof VARIANTS;

export function button(variant: ButtonVariant = "secondary", size: keyof typeof SIZES = "md"): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

/** A square button holding only an icon (its accessible name comes from aria-label). */
export const iconButton =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500/70 disabled:opacity-60 aria-expanded:bg-zinc-100 aria-expanded:text-zinc-900 pointer-coarse:size-11 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-expanded:bg-zinc-800 dark:aria-expanded:text-zinc-100";
