"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { FamilyCanvas } from "@/components/tree/FamilyCanvas";
import { buildSheetView } from "@/tree/sheet-view";
import type { GroupTree } from "@/tree/types";

/**
 * Sheet tabs over the group's data (F5). Each sheet is a view computed in the browser, so switching
 * tabs is instant: the URL changes with history.pushState, which Next.js's router follows, and the
 * server isn't asked again.
 */
export function GroupSheets({ groupId, tree }: { groupId: string; tree: GroupTree }) {
  const pathname = usePathname();
  // Pinned tabs first (Father's and Mother's), then the rest in their saved order.
  const sheets = useMemo(() => [...tree.sheets].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order), [tree.sheets]);
  const current = sheets.find((s) => pathname.endsWith(`/s/${s.id}`)) ?? sheets[0];
  const view = useMemo(() => buildSheetView(tree, current), [tree, current]);

  return (
    <>
      <div role="tablist" aria-label="Sheets" className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-4 pt-2 dark:border-zinc-800">
        {sheets.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === current.id}
            onClick={() => window.history.pushState(null, "", `/g/${groupId}/s/${s.id}`)}
            className="shrink-0 rounded-t-md border border-b-0 border-transparent px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 aria-selected:border-zinc-200 aria-selected:bg-white aria-selected:font-medium aria-selected:text-zinc-900 dark:aria-selected:border-zinc-800"
          >
            {s.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={current.title} className="flex-1">
        <FamilyCanvas view={view} />
      </div>
    </>
  );
}
