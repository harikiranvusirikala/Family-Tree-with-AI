"use client";

import { useEffect, useRef, useState } from "react";
import { LineIcon, type IconName } from "@/components/ui/icons";

export interface SettingsSection {
  id: string;
  label: string;
  icon: IconName;
  danger?: boolean;
}

/**
 * The page's own section, by id. Looked for inside this page's <main>: Next.js keeps other visited
 * settings pages in the document, hidden, with the same ids.
 */
function sectionIn(nav: HTMLElement | null, id: string) {
  return nav?.closest("main")?.querySelector<HTMLElement>(`[id="${id}"]`) ?? null;
}

/**
 * The settings' sections beside their cards, from 1024 px (the production look): the one in view is
 * marked, and choosing one scrolls to it and moves the focus there.
 */
export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
  const nav = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id);
      },
      { rootMargin: "0px 0px -55% 0px" }, // the top part of the screen
    );
    for (const { id } of sections) {
      const section = sectionIn(nav.current, id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [sections]);

  function go(id: string) {
    const section = sectionIn(nav.current, id);
    if (!section) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    section.focus({ preventScroll: true });
    setCurrent(id);
  }

  return (
    <nav ref={nav} aria-label="Settings sections" className="hidden lg:sticky lg:top-6 lg:block lg:w-52 lg:shrink-0">
      <ul className="flex flex-col gap-0.5">
        {sections.map((s) => {
          const here = current === s.id;
          const tone = s.danger ? "text-red-700 dark:text-red-400" : here ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400";
          const surface = here ? "bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900";
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={here ? "true" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  go(s.id);
                }}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ${tone} ${surface}`}
              >
                <LineIcon name={s.icon} className="size-4 shrink-0" />
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
