// The panels beside the tree (person, couple, import, the assistant). From 768 px they sit at the
// right of the canvas; on phones they open over it, so the tree keeps the whole width.

const colours = "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";

/**
 * The person and couple panels: on phones, over the bottom part of the tree (PHONE_PANEL_SHARE, which
 * the canvas keeps the selected card clear of), or all of it for a form (`full`).
 */
export const detailsPanel = (full: boolean) =>
  `absolute inset-x-0 bottom-0 z-20 flex flex-col gap-4 overflow-y-auto border-t p-4 shadow-[0_-6px_20px_rgb(0_0_0/0.12)] ${
    full ? "top-0" : "max-h-[55%] rounded-t-2xl"
  } md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-l md:border-t-0 md:shadow-none ${colours}`;

/** Import and the assistant: the whole tree's area on phones, a wider panel from 768 px. */
export const widePanel = `absolute inset-0 z-30 md:static md:z-auto md:w-96 md:shrink-0 md:border-l ${colours}`;
