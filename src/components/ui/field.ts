// The app's form fields (the production look, an owner request). Plain class strings, like button.ts.
// Touch screens get 16 px text from globals.css (iPhones zoom into smaller text).

const BASE =
  "rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600";

/** A one-line field or a dropdown, as wide as its column: 36 px like the buttons, 44 px on touch screens. */
export const field = `h-9 w-full ${BASE} pointer-coarse:min-h-11`;

/** The same, only as wide as what it holds: a dropdown in a row. */
export const compactField = `h-9 ${BASE} pointer-coarse:min-h-11`;

/** A button that opens a menu of choices and shows the chosen one, looking like a dropdown (a member's role). */
export const menuField =
  "inline-flex h-9 items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/70 aria-expanded:bg-zinc-50 disabled:opacity-60 pointer-coarse:min-h-11 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 dark:aria-expanded:bg-zinc-900";

/** A label above its field. */
export const fieldLabel = "flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100";

/** A line under a field, saying what it's for (linked with aria-describedby). */
export const fieldHint = "text-[13px] font-normal text-zinc-500 dark:text-zinc-400";

/** Checkboxes and radio buttons, in the app's colour. */
export const choice = "size-4 shrink-0 accent-zinc-900 dark:accent-zinc-100";

/** A checkbox or radio beside its words. */
export const choiceLabel = "flex items-center gap-2 text-sm text-zinc-800 pointer-coarse:min-h-11 dark:text-zinc-200";

/** A message under a form: what went wrong. */
export const formError = "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";

/** A message under a form: it worked (and, say, here's the link). */
export const formSuccess =
  "rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200";
