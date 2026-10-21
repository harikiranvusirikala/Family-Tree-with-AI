"use client";

import type { ReactNode } from "react";
import { EVERYONE_VIEWS, type EveryoneViewName } from "@/tree/everyone";

const icon = (path: ReactNode) => (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    {path}
  </svg>
);

const VIEWS: Record<EveryoneViewName, { label: string; icon: ReactNode }> = {
  tree: { label: "Tree", icon: icon(<path d="M12 4v6M6 14v-2h12v2M6 14v6M18 14v6" />) },
  list: { label: "List", icon: icon(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />) },
};

/** ★ Everyone's views (an owner request after the final check): the one shown is pressed. */
export function ViewSwitcher({ shown, onShow }: { shown: EveryoneViewName | null; onShow: (view: EveryoneViewName) => void }) {
  return (
    <div role="group" aria-label="View" className="flex shrink-0 rounded-full border border-zinc-300 p-0.5 max-sm:w-full dark:border-zinc-700">
      {EVERYONE_VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          aria-pressed={shown === view}
          onClick={() => onShow(view)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium hover:bg-zinc-100 aria-pressed:bg-zinc-900 aria-pressed:text-white pointer-coarse:min-h-11 dark:hover:bg-zinc-800 dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900"
        >
          {VIEWS[view].icon}
          {VIEWS[view].label}
        </button>
      ))}
    </div>
  );
}
