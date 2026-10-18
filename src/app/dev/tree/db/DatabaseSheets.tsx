"use client";

import { useMemo, useState } from "react";
import { FamilyCanvas } from "@/components/tree/FamilyCanvas";
import { buildSheetView } from "@/tree/sheet-view";
import type { GroupTree } from "@/tree/types";

/** Sheet tabs over one group's data: each sheet is a view, computed in the browser. */
export function DatabaseSheets({ tree }: { tree: GroupTree }) {
  const [sheetId, setSheetId] = useState(tree.sheets[0]?.id);
  const sheet = tree.sheets.find((s) => s.id === sheetId);
  const view = useMemo(() => (sheet ? buildSheetView(tree, sheet) : null), [tree, sheet]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-zinc-200 px-4 py-2 text-sm">
        <strong>Tree from the database (dev)</strong>
        <nav className="flex gap-1" aria-label="Sheets">
          {tree.sheets.map((s) => (
            <button
              key={s.id}
              aria-pressed={s.id === sheetId}
              className="rounded border px-2 py-0.5 aria-pressed:bg-zinc-900 aria-pressed:text-white"
              onClick={() => setSheetId(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>
        <span className="text-zinc-500" data-testid="person-count">
          {view?.persons.length ?? 0} people on this sheet · {tree.persons.length} in the group
        </span>
      </header>
      <div className="flex-1">{view ? <FamilyCanvas view={view} /> : <p className="p-4">No sheets yet.</p>}</div>
    </div>
  );
}
