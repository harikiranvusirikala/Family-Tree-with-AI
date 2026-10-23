"use client";

import { EVERYONE_VIEWS, type EveryoneViewName } from "@/tree/everyone";
import { LineIcon, type IconName } from "../ui/icons";

const VIEWS: Record<EveryoneViewName, { label: string; icon: IconName }> = {
  tree: { label: "Tree", icon: "tree" },
  wheel: { label: "Wheel", icon: "target" },
  network: { label: "Network", icon: "network" },
  list: { label: "List", icon: "list" },
  upcoming: { label: "Upcoming", icon: "calendar" },
};

/**
 * ★ Everyone's views (an owner request after the final check): the one shown is pressed, raised in white
 * like the open sheet tab (the production look). Below 640 px the icons go, so the five names fit a phone.
 */
export function ViewSwitcher({ shown, onShow }: { shown: EveryoneViewName | null; onShow: (view: EveryoneViewName) => void }) {
  return (
    <div role="group" aria-label="View" className="flex shrink-0 gap-0.5 rounded-xl bg-zinc-100 p-1 max-sm:w-full dark:bg-zinc-900">
      {EVERYONE_VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          aria-pressed={shown === view}
          onClick={() => onShow(view)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium text-zinc-600 outline-none hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500/70 aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-sm max-sm:px-1.5 pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-pressed:bg-zinc-800 dark:aria-pressed:text-zinc-100"
        >
          <LineIcon name={VIEWS[view].icon} className="size-4 max-sm:hidden" />
          {VIEWS[view].label}
        </button>
      ))}
    </div>
  );
}
