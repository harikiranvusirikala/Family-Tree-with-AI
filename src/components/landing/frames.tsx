import type { ReactNode } from "react";

/** A screenshot in a computer window: a title bar with three dots above it. */
export function BrowserFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50 ${className}`}>
      <div aria-hidden className="flex h-6 items-center gap-1.5 border-b border-zinc-200 bg-zinc-100 px-3 sm:h-7 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="size-2 rounded-full bg-[#f87171] sm:size-2.5" />
        <span className="size-2 rounded-full bg-[#fbbf24] sm:size-2.5" />
        <span className="size-2 rounded-full bg-[#34d399] sm:size-2.5" />
      </div>
      {children}
    </div>
  );
}

/** A phone screenshot in a dark phone body, with corners that shrink with the phone. */
export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[clamp(0.9rem,3.2vw,2.25rem)] bg-zinc-900 p-[clamp(3px,0.7vw,9px)] shadow-2xl shadow-zinc-900/25 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:shadow-black/50 dark:ring-white/10 ${className}`}>
      <div className="overflow-hidden rounded-[clamp(0.7rem,2.6vw,1.75rem)] bg-white dark:bg-zinc-900">{children}</div>
    </div>
  );
}
