import type { ReactNode } from "react";

/** A page's heading with a sentence under it, and its main buttons on the right (below it on phones). */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px] dark:text-zinc-100">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-pretty text-zinc-600 dark:text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}
