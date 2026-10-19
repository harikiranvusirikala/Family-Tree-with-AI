"use client";

import type { ReactNode } from "react";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "./theme";

const icon = (paths: ReactNode) => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

const CHOICES: { choice: ThemeChoice; label: string; icon: ReactNode }[] = [
  {
    choice: "light",
    label: "Day theme",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>,
    ),
  },
  { choice: "dark", label: "Night theme", icon: icon(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />) },
  {
    choice: "system",
    label: "Follow device",
    icon: icon(
      <>
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>,
    ),
  },
];

/**
 * Day, night, or follow the device: three small buttons, the chosen one highlighted. Disabled until
 * React knows the choice the page opened with.
 */
export function ThemeToggle() {
  const current = useThemeChoice();
  return (
    <div role="group" aria-label="Theme" className="flex shrink-0 items-center rounded-full border border-zinc-200 p-0.5 dark:border-zinc-800">
      {CHOICES.map(({ choice, label, icon }) => (
        <button
          key={choice}
          type="button"
          onClick={() => setThemeChoice(choice)}
          disabled={!current}
          aria-label={label}
          aria-pressed={current === choice}
          title={label}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 aria-pressed:bg-zinc-200 aria-pressed:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-pressed:bg-zinc-700 dark:aria-pressed:text-zinc-100"
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
