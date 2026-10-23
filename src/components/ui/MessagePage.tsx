import Image from "next/image";
import type { ReactNode } from "react";
import { LineIcon, type IconName } from "./icons";

/**
 * A page that says one thing (the production look, an owner request): no access, an invite, not
 * found, an error. A card in the middle with an icon (or the app's), a heading and what to do next.
 */
export function MessagePage({ icon, title, children, testId }: { icon?: IconName; title: string; children: ReactNode; testId?: string }) {
  return (
    <main data-testid={testId} className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 sm:py-20 dark:bg-zinc-950">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center shadow-sm sm:px-8 dark:border-zinc-800 dark:bg-zinc-900">
        {icon ? (
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <LineIcon name={icon} className="size-6" />
          </span>
        ) : (
          <Image src="/icon.svg" alt="" width={48} height={48} className="size-12 rounded-[22%] dark:ring-1 dark:ring-white/15" />
        )}
        <h1 className="text-xl font-semibold tracking-tight text-balance text-zinc-900 dark:text-zinc-100">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** A sentence or two under the heading. */
export function MessageText({ children, role }: { children: ReactNode; role?: "status" }) {
  return (
    <p role={role} className="text-[15px] leading-relaxed text-pretty text-zinc-600 dark:text-zinc-400">
      {children}
    </p>
  );
}
