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

/** The sheet page's shape while it loads: the header, the sheet row, and a few cards where the tree goes. */
export function TreeLoading() {
  const card = `${skeleton} size-14 rounded-full`;
  return (
    <div className="flex h-dvh flex-col bg-white dark:bg-zinc-950">
      <div className="h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-800" />
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className={`${skeleton} h-8 w-72 max-w-[60%] rounded-xl`} />
        <div className={`${skeleton} ml-auto h-8 w-24 rounded-lg`} />
      </div>
      <main aria-busy="true" className="flex flex-1 flex-col items-center justify-center gap-12">
        <span className="sr-only">Loading…</span>
        <div className="flex gap-16">
          <div className={card} />
          <div className={card} />
        </div>
        <div className="flex gap-16">
          <div className={card} />
          <div className={card} />
          <div className={card} />
        </div>
      </main>
    </div>
  );
}
