"use client";

import { ImportPanel } from "@/components/import-export/ImportPanel";
import { button } from "@/components/ui/button";
import { DialogButton } from "@/components/ui/Dialog";
import { LineIcon } from "@/components/ui/icons";
import { importGroupAction } from "./actions";

/** F10: a new group from a GEDCOM or JSON file, in a dialog on the dashboard. The import opens when it's saved. */
export function ImportNewGroup() {
  return (
    <DialogButton
      title="Import a family file"
      bare
      wide
      buttonClassName={button("secondary")}
      button={
        <>
          <LineIcon name="upload" className="size-4" />
          Import a file
        </>
      }
    >
      {(close) => (
        <ImportPanel
          tree={{ persons: [], unions: [], sheets: [] }}
          newGroup
          onImport={async (batch, name) => (await importGroupAction(name, batch.operations)).error}
          onClose={close}
        />
      )}
    </DialogButton>
  );
}
