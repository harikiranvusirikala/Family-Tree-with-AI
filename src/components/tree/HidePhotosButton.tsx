"use client";

/**
 * The eye button at the end of the sheet tabs: hides every photo, so the cards, the panel and a picture
 * of the sheet show initials, for sharing without faces (an owner request after step 11). Pressed
 * while photos are hidden, when the eye gets a line through it.
 *
 * `plain`: below 1024 px it sits just before the sheet menu, a bigger eye with no circle around it, like
 * the menu's ⋯ (the owner's choice after the preview). On computers it's a round button like Export.
 */
export function HidePhotosButton({ hidden, onToggle, plain = false }: { hidden: boolean; onToggle: () => void; plain?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Hide photos"
      aria-pressed={hidden}
      title={hidden ? "Photos are hidden: show them" : "Hide photos, showing initials"}
      onClick={onToggle}
      className={
        plain
          ? "flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 aria-pressed:text-zinc-900 pointer-coarse:h-11 pointer-coarse:w-11 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:text-zinc-100"
          : "rounded-full border border-zinc-300 p-1.5 hover:bg-zinc-100 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900"
      }
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={plain ? "h-6 w-6" : "h-4 w-4"}>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}
