"use client";

import { useMemo, useState } from "react";
import { FamilyCanvas } from "@/components/tree/FamilyCanvas";
import { buildSheetView } from "@/tree/sheet-view";
import type { FamilyData, Person } from "@/tree/types";
import { cruzYoung, inLawParentIds } from "@test/fixtures/cruz-young";

const rootChoices = [...cruzYoung.persons].sort((a, b) => a.name.localeCompare(b.name) || (a.birthYear ?? 0) - (b.birthYear ?? 0));

/** The sample family on the canvas, with controls to try different sheets and auto-layout. */
export function TreePlayground() {
  const [rootId, setRootId] = useState("alexander-cruz");
  const [showInLawParents, setShowInLawParents] = useState(true);
  const [addedChildren, setAddedChildren] = useState(0);

  const data = useMemo<FamilyData>(() => {
    const babies: Person[] = Array.from({ length: addedChildren }, (_, i) => ({
      id: `baby-${i + 1}`,
      name: `Baby ${i + 1}`,
      gender: i % 2 ? "male" : "female",
      birthYear: 2026,
    }));
    return {
      persons: [...cruzYoung.persons, ...babies],
      unions: cruzYoung.unions.map((u) =>
        u.id === "u-jane-william" ? { ...u, childIds: [...u.childIds, ...babies.map((b) => b.id)] } : u,
      ),
    };
  }, [addedChildren]);

  const view = useMemo(
    () => buildSheetView(data, { rootPersonId: rootId, extraPersonIds: showInLawParents ? inLawParentIds : [] }),
    [data, rootId, showInLawParents],
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
        <strong>Tree layout (dev)</strong>
        <label className="flex items-center gap-2">
          Sheet rooted at
          <select className="rounded border px-1 py-0.5" value={rootId} onChange={(e) => setRootId(e.target.value)}>
            {rootChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.birthYear})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showInLawParents} onChange={(e) => setShowInLawParents(e.target.checked)} />
          Show in-law parents as extras
        </label>
        <button className="rounded border px-2 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setAddedChildren((n) => n + 1)}>
          Add a child to Jane &amp; William
        </button>
        <span className="text-zinc-500 dark:text-zinc-400" data-testid="person-count">
          {view.persons.length} people on this sheet
        </span>
      </header>
      <div className="flex-1">
        <FamilyCanvas view={view} />
      </div>
    </div>
  );
}
