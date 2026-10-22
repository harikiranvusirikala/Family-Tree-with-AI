import type { ReactNode } from "react";

/**
 * One part of the landing page: a full-width band (tinted when `tinted`) with its content centred, and
 * a region named by its heading (`${id}-title`, see SectionHeading).
 */
export function Section({ id, tinted = false, children }: { id: string; tinted?: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-16 py-20 sm:py-24 ${tinted ? "bg-zinc-50 dark:bg-zinc-900/40" : ""}`}>
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

/** A small label, the part's heading and a sentence or two, centred above what follows. */
export function SectionHeading({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={`${id}-title`} className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
        {title}
      </h2>
      {children && <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</p>}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">{children}</p>;
}
