import type { ReactNode } from "react";

/** The landing page's line icons: 24 px grid, drawn in the text colour like the theme switch's. */
const PATHS = {
  tree: (
    <>
      <rect x="9" y="2.5" width="6" height="5" rx="1.5" />
      <rect x="2.5" y="16.5" width="6" height="5" rx="1.5" />
      <rect x="15.5" y="16.5" width="6" height="5" rx="1.5" />
      <path d="M12 7.5V12M5.5 16.5V14a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2.5" />
    </>
  ),
  sheets: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  photo: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4-4-11 10" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </>
  ),
  transfer: <path d="M7 20V4M3 8l4-4 4 4M17 4v16M21 16l-4 4-4-4" />,
  code: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />,
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20.5v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.6a5 5 0 0 1 3 4.6v1.3" />
    </>
  ),
  sparkle: <path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7Z" />,
  shield: (
    <>
      <path d="M12 21.5s7.5-3.5 7.5-9.5V5.5L12 2.5l-7.5 3V12c0 6 7.5 9.5 7.5 9.5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function LineIcon({ name, className = "size-6" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[name]}
    </svg>
  );
}

/** GitHub's mark (its Octicons "mark-github"), for the link to the code. */
export function GitHubMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
