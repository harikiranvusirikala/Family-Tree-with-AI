"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { FamilyCanvas } from "@/components/tree/FamilyCanvas";
import { CouplePanel } from "@/components/tree/edit/CouplePanel";
import { PersonPanel } from "@/components/tree/edit/PersonPanel";
import { SheetTabs } from "@/components/tree/edit/SheetTabs";
import { CloudNameContext } from "@/components/tree/photo";
import type { Operation } from "@/server/operations/schema";
import { deletePersonOps, restorePersonOps, tabOrder } from "@/tree/edits";
import { buildSheetView } from "@/tree/sheet-view";
import type { GroupTree, Person } from "@/tree/types";
import { applyChangesAction, signPhotoUploadAction } from "../actions";

type Selection = { kind: "person" | "couple"; id: string } | null;

const UNDO_SECONDS = 10;

/**
 * A group's sheets (F5) and editing them by hand (F6). Each sheet is a view computed in the browser,
 * so switching tabs is instant: the URL changes with history.pushState, which Next.js's router follows.
 * Every change goes to the server as one batch; the page then re-renders with the new data and the
 * canvas lays itself out again. `cloudName` is given when photos are set up (F8).
 */
export function GroupSheets({ groupId, tree, canEdit, cloudName }: { groupId: string; tree: GroupTree; canEdit: boolean; cloudName?: string }) {
  const pathname = usePathname();
  const sheets = useMemo(() => tabOrder(tree.sheets), [tree.sheets]);
  const found = sheets.find((s) => pathname.endsWith(`/s/${s.id}`));
  const current = found ?? sheets[0];
  const view = useMemo(() => buildSheetView(tree, current), [tree, current]);


  const [selection, setSelection] = useState<Selection>(null);
  const [deleted, setDeleted] = useState<Person | null>(null); // for Undo
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A mistyped or removed sheet in the URL: show the first one, and say so in the address bar. Not
  // while saving: a new sheet's URL is set just before the data with that sheet arrives.
  useEffect(() => {
    if (!found && !pending) window.history.replaceState(null, "", `/g/${groupId}/s/${current.id}`);
  }, [found, pending, current.id, groupId]);

  const openSheet = (sheetId: string) => window.history.pushState(null, "", `/g/${groupId}/s/${sheetId}`);

  /** Sends one batch. Resolves to the new ids once the page shows the change, or null after an error. */
  const run = (ops: Operation[]) =>
    new Promise<Record<string, string> | null>((resolve) => {
      setError(null);
      startTransition(async () => {
        const result = await applyChangesAction(groupId, ops);
        if (result.error !== undefined) {
          setError(result.error);
          resolve(null);
        } else resolve(result.idMap);
      });
    });

  async function deletePerson(person: Person) {
    if (await run(deletePersonOps(person.id))) {
      setSelection(null);
      setDeleted(person);
    }
  }

  async function undoDelete() {
    if (!deleted) return;
    if (await run(restorePersonOps(deleted.id))) setDeleted(null);
  }

  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(null), UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [deleted]);

  const person = selection?.kind === "person" ? tree.persons.find((p) => p.id === selection.id) : undefined;
  const couple = selection?.kind === "couple" ? tree.unions.find((u) => u.id === selection.id) : undefined;
  const panelProps = {
    tree,
    canEdit,
    pending,
    run,
    onSelect: (id: string) => setSelection({ kind: "person", id }),
    onClose: () => setSelection(null),
  } as const;

  return (
    <CloudNameContext value={cloudName}>
      <SheetTabs tree={tree} sheets={sheets} current={current} canEdit={canEdit} pending={pending} run={run} onOpen={openSheet} />
      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      )}
      <div className="relative flex min-h-0 flex-1">
        <div role="tabpanel" aria-label={current.title} className="min-w-0 flex-1">
          <FamilyCanvas
            view={view}
            actions={{
              onPerson: (id) => setSelection({ kind: "person", id }),
              onCouple: (id) => setSelection({ kind: "couple", id }),
              selectedId: selection?.id,
            }}
          />
        </div>
        {person && (
          <PersonPanel
            key={person.id}
            person={person}
            onDelete={deletePerson}
            signPhotoUpload={cloudName ? () => signPhotoUploadAction(groupId) : undefined}
            {...panelProps}
          />
        )}
        {couple && <CouplePanel key={couple.id} union={couple} {...panelProps} />}
        {deleted && (
          <div role="status" className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900">
            <span>{deleted.name} deleted.</span>
            <button type="button" onClick={undoDelete} disabled={pending} className="font-semibold underline">
              Undo
            </button>
          </div>
        )}
      </div>
    </CloudNameContext>
  );
}
