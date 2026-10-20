"use client";

/**
 * The eye button at the end of the sheet tabs: hides every photo, so the cards, the panel and a
 * picture of the sheet show initials, for sharing without faces (an owner request after step 11).
 * Pressed while photos are hidden.
 */
export function HidePhotosButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label="Hide photos"
      aria-pressed={hidden}
      title={hidden ? "Photos are hidden: show them" : "Hide photos, showing initials"}
      onClick={onToggle}
      className="rounded-full border border-zinc-300 p-1.5 hover:bg-zinc-100 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}
