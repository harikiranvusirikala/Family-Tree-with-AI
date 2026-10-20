"use client";

import type { Operation } from "@/server/operations/schema";
import { describeOperations } from "@/tree/describe";
import type { GroupTree } from "@/tree/types";

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
    <section aria-label="Proposed changes" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <h3 className="font-medium">Proposed changes</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {describeOperations(operations, tree).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">Nothing is saved until you confirm.</p>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} disabled={busy} className="rounded-full bg-zinc-900 px-4 py-1.5 font-medium text-white disabled:opacity-60 pointer-coarse:min-h-11 dark:bg-white dark:text-zinc-900">
          Confirm
        </button>
        <button type="button" onClick={onDiscard} disabled={busy} className="rounded-full px-4 py-1.5 hover:bg-amber-100 disabled:opacity-60 pointer-coarse:min-h-11 dark:hover:bg-amber-900/50">
          Discard
        </button>
      </div>
    </section>
  );
}
