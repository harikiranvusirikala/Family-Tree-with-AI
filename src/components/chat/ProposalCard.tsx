"use client";

import type { Operation } from "@/server/operations/schema";
import { describeOperations } from "@/tree/describe";
import type { GroupTree } from "@/tree/types";
import { button } from "../ui/button";
import { LineIcon } from "../ui/icons";

/**
 * F7: the assistant's pending changes in plain words. Confirm saves them all, or none, through the
 * same server action as editing by hand; Discard drops them.
 */
export function ProposalCard({
  operations,
  tree,
  busy,
  onConfirm,
  onDiscard,
}: {
  operations: Operation[];
  tree: GroupTree;
  busy: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  return (
    <section aria-label="Proposed changes" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
      <h3 className="flex items-center gap-2 font-semibold">
        <LineIcon name="pencil" className="size-4 text-amber-700 dark:text-amber-300" />
        Proposed changes
      </h3>
      <ul className="flex flex-col gap-1.5">
        {describeOperations(operations, tree).map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-amber-500" />
            {line}
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">Nothing is saved until you confirm.</p>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} disabled={busy} className={button("primary", "sm")}>
          <LineIcon name="check" className="size-4" />
          Confirm
        </button>
        <button type="button" onClick={onDiscard} disabled={busy} className={button("ghost", "sm")}>
          Discard
        </button>
      </div>
    </section>
  );
}
