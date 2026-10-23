// The app's form fields (the production look, an owner request). Plain class strings, like button.ts.
// Touch screens get 16 px text from globals.css (iPhones zoom into smaller text).

export const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 pointer-coarse:min-h-11 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600";

/** A label above its field. */
export const fieldLabel = "flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100";

/** Checkboxes and radio buttons, in the app's colour. */
export const choice = "size-4 shrink-0 accent-zinc-900 dark:accent-zinc-100";

/** A checkbox or radio beside its words. */
export const choiceLabel = "flex items-center gap-2 text-sm text-zinc-800 pointer-coarse:min-h-11 dark:text-zinc-200";

/** A message under a form: what went wrong. */
export const formError = "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
