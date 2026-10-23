// Cards (the production look, an owner request): white panels on the page's grey, with a border and a
// soft shadow. Plain class strings, like button.ts.

export const card = "rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/** A card for what can't be taken back: deleting, leaving. */
export const dangerCard = "rounded-2xl border border-red-200 bg-white shadow-sm dark:border-red-900/60 dark:bg-zinc-900";

/** A card's title row, above its list. */
export const cardHeader = "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-200 px-4 py-3.5 sm:px-5 dark:border-zinc-800";

export const cardTitle = "text-base font-semibold text-zinc-900 dark:text-zinc-100";

/** A sentence under a card's title. */
export const cardText = "text-sm text-pretty text-zinc-600 dark:text-zinc-400";

/** A card's list, one row per item. */
export const cardRows = "divide-y divide-zinc-200 dark:divide-zinc-800";
