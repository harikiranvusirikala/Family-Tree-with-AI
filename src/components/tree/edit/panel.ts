// The panels beside the tree (person, couple, import, the assistant). From 768 px they sit at the
// right of the canvas; on phones they open over it, so the tree keeps the whole width.

const colours = "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";

/**
 * The person and couple panels: on phones a sheet over the bottom part of the tree (PHONE_PANEL_SHARE,
 * which the canvas keeps the selected card clear of), or all of it for a form (`full`). Their parts pad
 * themselves: `panelHeader`, `panelBody` and `panelFooter` (the production look).
 */
export const detailsPanel = (full: boolean) =>
  `absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-y-auto overscroll-contain border-t shadow-[0_-8px_24px_rgb(0_0_0/0.14)] ${
    full ? "top-0" : "max-h-[55%] rounded-t-2xl"
  } md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none lg:w-[22rem] ${colours}`;

/** The photo, the name and Close. */
export const panelHeader = "flex items-start gap-4 p-5 pb-4";
export const panelBody = "flex flex-col gap-5 px-5 pb-5";
/** Delete, apart at the bottom. */
export const panelFooter = "mt-auto border-t border-zinc-200 px-3 py-2 dark:border-zinc-800";
/** A small heading over a group in a panel: Parents, Children. */
export const panelHeading = "px-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400";
/** A quiet line in a panel ("Not added"). */
export const panelNote = "px-2 text-sm text-zinc-500 dark:text-zinc-400";

/** Import and the assistant: the whole tree's area on phones, a wider panel from 768 px. */
export const widePanel = `absolute inset-0 z-30 md:static md:z-auto md:w-96 md:shrink-0 md:border-l ${colours}`;
