"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ExportMenu } from "@/components/import-export/ExportMenu";
import { ImportPanel } from "@/components/import-export/ImportPanel";
import { FamilyCanvas, type CapturePicture } from "@/components/tree/FamilyCanvas";
import { downloadPicture, printPicture } from "@/components/tree/sheet-picture";
import { fileName } from "@/server/import-export/types";
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
 * canvas lays itself out again. `cloudName` is given when photos are set up (F8), `chat` when the
 * assistant is (F7).
 */
export function GroupSheets({
  groupId,
  tree,
  canEdit,
  cloudName,
  chat,
}: {
  groupId: string;
  tree: GroupTree;
  canEdit: boolean;
  cloudName?: string;
  chat: boolean;
}) {
  const pathname = usePathname();
  const sheets = useMemo(() => tabOrder(tree.sheets), [tree.sheets]);
  const found = sheets.find((s) => pathname.endsWith(`/s/${s.id}`));
  const current = found ?? sheets[0];
  const view = useMemo(() => buildSheetView(tree, current), [tree, current]);


  const [selection, setSelection] = useState<Selection>(null);
  const [deleted, setDeleted] = useState<Person | null>(null); // for Undo
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [chatOpen, setChatOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [picturing, setPicturing] = useState(false);
  const capture = useRef<CapturePicture | null>(null);

  /** Export, picture (F9): the whole sheet, then a download or the print dialog. */
  async function picture(then: (dataUrl: string) => void) {
    if (!capture.current) return;
    setPicturing(true);
    setError(null);
    try {
      then(await capture.current());
    } catch (cause) {
      console.error("Sheet picture failed:", cause);
      setError("The picture couldn't be made. Try again.");
    } finally {
      setPicturing(false);
    }
  }

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
      <SheetTabs
        tree={tree}
        sheets={sheets}
        current={current}
        canEdit={canEdit}
        pending={pending}
        run={run}
        onOpen={openSheet}
        trailing={
          <div className="flex items-center gap-2">
            <ExportMenu
              groupId={groupId}
              sheetId={current.id}
              canExportData={canEdit}
              busy={picturing}
              onPicture={() => picture((url) => downloadPicture(url, fileName(current.title)))}
              onPrint={() => picture((url) => printPicture(url, current.title))}
            />
            {canEdit && (
              <button
                type="button"
                aria-expanded={importOpen}
                onClick={() => setImportOpen(!importOpen)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 aria-expanded:bg-zinc-900 aria-expanded:text-white dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-expanded:bg-white dark:aria-expanded:text-zinc-900"
              >
                Import…
              </button>
            )}
            {chat && (
              <button
                type="button"
                aria-expanded={chatOpen}
                onClick={() => setChatOpen(!chatOpen)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 aria-expanded:bg-zinc-900 aria-expanded:text-white dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-expanded:bg-white dark:aria-expanded:text-zinc-900"
              >
                Ask AI
              </button>
            )}
          </div>
        }
      />
      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      )}
      <div className="relative flex min-h-0 flex-1">
        <div role="tabpanel" aria-label={current.title} className="min-w-0 flex-1">
          <FamilyCanvas
            view={view}
            captureRef={capture}
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
        {importOpen && (
          <aside aria-label="Import" className="w-96 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white p-4 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
            <ImportPanel
              tree={tree}
              targetGroupId={groupId}
              onImport={async (batch) => {
                const idMap = await run(batch.operations);
                if (!idMap) return "Not imported: see the message above the tree.";
                setImportOpen(false);
                openSheet(idMap[batch.firstSheet]);
                return null;
              }}
              onClose={() => setImportOpen(false)}
            />
          </aside>
        )}
        {/* Kept mounted while hidden, so closing the panel doesn't lose the conversation. */}
        {chat && (
          <div hidden={!chatOpen} className="flex">
            <ChatWidget groupId={groupId} tree={tree} run={run} pending={pending} onClose={() => setChatOpen(false)} />
          </div>
        )}
        {deleted && (
          <div role="status" className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900">
            <span>{deleted.name} deleted.</span>
            <button type="button" onClick={undoDelete} disabled={pending} className="font-semibold underline">
              Undo
            </button>
          </div>
        )}
      </div>
      {/* Covers the page while the picture is made in day colours, so night mode doesn't flash. */}
      {picturing && (
        <div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-sm font-medium text-white">
          Preparing the picture…
        </div>
      )}
    </CloudNameContext>
  );
}
