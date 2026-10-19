"use client";

import { useState } from "react";
import { ImportPanel } from "@/components/import-export/ImportPanel";
import { importGroupAction } from "./actions";

/** F10: a new group from a GEDCOM or JSON file, on the dashboard. The import opens when it's saved. */
export function ImportNewGroup() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Import a family file…
        </button>
      </div>
    );
  }
  return (
    <ImportPanel
      tree={{ persons: [], unions: [], sheets: [] }}
      newGroup
      onImport={async (batch, name) => (await importGroupAction(name, batch.operations)).error}
      onClose={() => setOpen(false)}
    />
  );
}
