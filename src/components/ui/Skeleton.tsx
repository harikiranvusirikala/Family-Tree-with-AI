import type { ReactNode } from "react";
import { pageFrame } from "./page";

/** A grey block that pulses where something is loading; give it its size and corners. */
export const skeleton = "animate-pulse bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800";

/**
 * A signed-in page's shape while it loads (the production look): the header's bar, then the page's
 * own blocks in `main`, so nothing jumps when the page arrives.
 */
export function LoadingPage({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={pageFrame}>
      <div className="h-14 shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
      <main aria-busy="true" className={className}>
        <span className="sr-only">Loading…</span>
        {children}
      </main>
    </div>
  );
}
