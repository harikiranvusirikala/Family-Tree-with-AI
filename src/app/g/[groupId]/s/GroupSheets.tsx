"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ExportItems, ExportMenu } from "@/components/import-export/ExportMenu";
import { ImportPanel } from "@/components/import-export/ImportPanel";
import { isPhone } from "@/components/screen";
import { EveryoneList } from "@/components/tree/EveryoneList";
import { FamilyCanvas, type CanvasFocus, type CapturePicture } from "@/components/tree/FamilyCanvas";
import { FindSomeone } from "@/components/tree/FindSomeone";
import { ViewSwitcher } from "@/components/tree/ViewSwitcher";
import { downloadPicture, printPicture } from "@/components/tree/sheet-picture";
import { fileName } from "@/server/import-export/types";
import { CouplePanel } from "@/components/tree/edit/CouplePanel";
import { PersonPanel } from "@/components/tree/edit/PersonPanel";
import { widePanel } from "@/components/tree/edit/panel";
import { SheetTabs, sheetMenuHeading, sheetMenuItem } from "@/components/tree/edit/SheetTabs";
import { HidePhotosButton } from "@/components/tree/HidePhotosButton";
import { CloudNameContext, PhotosHiddenContext } from "@/components/tree/photo";
import type { Operation } from "@/server/operations/schema";
import { deletePersonOps, restorePersonOps, tabOrder } from "@/tree/edits";
import { chooseView, EVERYONE, everyoneHref, everyoneView, isEveryoneView, listRows, type EveryoneViewName, type ListFilter } from "@/tree/everyone";
import { buildSheetView } from "@/tree/sheet-view";
import type { GroupTree, Person } from "@/tree/types";
import { applyChangesAction, signPhotoUploadAction } from "../actions";

type Selection = { kind: "person" | "couple"; id: string } | null;

const UNDO_SECONDS = 10;

/** The ★ Everyone view last used in this browser. */
const VIEW_KEY = "everyone-view";
function savedView(): string | null {
  try {
    return localStorage.getItem(VIEW_KEY);
  } catch {
    return null; // storage blocked: the device's first view
  }
}

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
  const searchParams = useSearchParams();
  const sheets = useMemo(() => tabOrder(tree.sheets), [tree.sheets]);
  // ★ Everyone (an owner request after the final check): every person, at /s/everyone. `current` is
  // then the first sheet, which the tabs need but don't offer options for. Its address also holds the
  // view (`?view=list`) and the selected person (`&person=`), so a link opens the same.
  const everyone = pathname.endsWith(`/s/${EVERYONE}`);
  const found = everyone ? undefined : sheets.find((s) => pathname.endsWith(`/s/${s.id}`));
  const current = found ?? sheets[0];
  const view = useMemo(() => (everyone ? everyoneView(tree) : buildSheetView(tree, current)), [everyone, tree, current]);
  const couples = view.unions.filter((u) => u.partnerIds.length === 2).length;
  const addressView = everyone ? searchParams.get("view") : null;
  /** Null until the address has a view: the device's choice is made in an effect, below. */
  const shownView: EveryoneViewName | null = isEveryoneView(addressView) ? addressView : null;
  const drawn = !everyone || shownView === "tree"; // a tree to picture
  const listShown = everyone && shownView === "list";
  const rows = useMemo(() => (listShown ? listRows(tree) : []), [listShown, tree]);
  const [listFilter, setListFilter] = useState<ListFilter>("everyone");
  const [listQuery, setListQuery] = useState("");

  const [selection, setSelection] = useState<Selection>(() => {
    const id = everyone ? searchParams.get("person") : null;
    return id && tree.persons.some((p) => p.id === id) ? { kind: "person", id } : null;
  });
  const [deleted, setDeleted] = useState<Person | null>(null); // for Undo
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [chatOpen, setChatOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [picturing, setPicturing] = useState(false);
  // The eye button: kept while switching sheets, back to showing photos on the next visit.
  const [photosHidden, setPhotosHidden] = useState(false);
  const capture = useRef<CapturePicture | null>(null);
  // Find someone, or the person in a ★ Everyone link: their card is centred.
  const [focus, setFocus] = useState<CanvasFocus | null>(() => (selection ? { personId: selection.id } : null));
  const selectedPerson = selection?.kind === "person" ? selection.id : undefined;

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
    if (!found && !everyone && !pending) window.history.replaceState(null, "", `/g/${groupId}/s/${current.id}`);
  }, [found, everyone, pending, current.id, groupId]);

  // ★ Everyone's address follows the view and the selected person. Opened without a view (a link from
  // before the List): the one last used on this device, else List on a phone and Tree elsewhere.
  useEffect(() => {
    if (!everyone) return;
    const href = everyoneHref(groupId, shownView ?? chooseView(null, savedView(), isPhone()), selectedPerson);
    if (href !== window.location.pathname + window.location.search) window.history.replaceState(null, "", href);
  }, [everyone, shownView, selectedPerson, groupId]);

  useEffect(() => {
    if (!shownView) return;
    try {
      localStorage.setItem(VIEW_KEY, shownView);
    } catch {
      // storage blocked: the device's first view next time
    }
  }, [shownView]);

  const openSheet = (sheetId: string) =>
    window.history.pushState(
      null,
      "",
      sheetId === EVERYONE ? everyoneHref(groupId, chooseView(null, savedView(), isPhone()), selectedPerson) : `/g/${groupId}/s/${sheetId}`,
    );

  /** The view switcher. Back returns to the view before, as with tabs. */
  function showView(next: EveryoneViewName) {
    if (next === shownView) return;
    setFocus(next === "tree" && selectedPerson ? { personId: selectedPerson } : null); // the Tree opens at them
    window.history.pushState(null, "", everyoneHref(groupId, next, selectedPerson));
  }

  /** The panel's Find in list: the List, showing everyone, with their row in view. */
  function findInList(personId: string) {
    setListFilter("everyone");
    setListQuery("");
    window.history.pushState(null, "", everyoneHref(groupId, "list", personId));
  }

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
  // The List draws no tree, so it has only the data to export (Maintain and up).
  const exportable = drawn || canEdit;
  const exportProps = {
    groupId,
    sheetId: everyone ? undefined : current.id,
    canExportData: canEdit,
    onPicture: drawn ? () => picture((url) => downloadPicture(url, fileName(everyone ? "Everyone" : current.title))) : undefined,
    onPrint: drawn ? () => picture((url) => printPicture(url, everyone ? "Everyone" : current.title)) : undefined,
  };
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
      <PhotosHiddenContext value={photosHidden}>
        <SheetTabs
          tree={tree}
          sheets={sheets}
          current={current}
          canEdit={canEdit}
          pending={pending}
          run={run}
          onOpen={openSheet}
          everyone={everyone}
          // Below 1024 px the eye stays in the row, just before the sheet menu (the owner's choice), the
          // other tools are items in that menu, and Ask AI is a round button.
          beforeMenu={cloudName && <HidePhotosButton plain hidden={photosHidden} onToggle={() => setPhotosHidden(!photosHidden)} />}
          menuItems={
            exportable && (
              <>
                <p className={sheetMenuHeading}>Export</p>
                <ExportItems {...exportProps} itemClass={sheetMenuItem} headings={false} />
                {canEdit && (
                  <button type="button" role="menuitem" onClick={() => setImportOpen(true)} className={sheetMenuItem}>
                    Import…
                  </button>
                )}
              </>
            )
          }
          trailing={
            <div className="flex items-center gap-2">
              {cloudName && <HidePhotosButton hidden={photosHidden} onToggle={() => setPhotosHidden(!photosHidden)} />}
              {exportable && <ExportMenu {...exportProps} busy={picturing} />}
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
        {everyone && (
          // The views, the count and Find someone; on phones the views get a row of their own.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-200 px-3 py-2 md:px-4 dark:border-zinc-800">
            <ViewSwitcher shown={shownView} onShow={showView} />
            <p className="hidden shrink-0 text-sm text-zinc-500 sm:block dark:text-zinc-400">
              {view.persons.length} {view.persons.length === 1 ? "person" : "people"} · {couples} {couples === 1 ? "couple" : "couples"}
            </p>
            <div className="w-full sm:ml-auto sm:w-72">
              {listShown ? (
                // In the List, Find someone narrows the rows as you type (the owner's choice).
                <input
                  type="search"
                  aria-label="Find someone"
                  placeholder="Find someone…"
                  value={listQuery}
                  onChange={(event) => setListQuery(event.target.value)}
                  className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm pointer-coarse:h-11 dark:border-zinc-700 dark:bg-zinc-900"
                />
              ) : (
                <FindSomeone
                  persons={view.persons}
                  onChoose={(id) => {
                    setSelection({ kind: "person", id });
                    setFocus({ personId: id });
                  }}
                />
              )}
            </div>
          </div>
        )}
        <div className="relative flex min-h-0 flex-1">
          <div role="tabpanel" aria-label={everyone ? "Everyone" : current.title} className="relative min-w-0 flex-1">
            {listShown ? (
              <EveryoneList
                rows={rows}
                filter={listFilter}
                query={listQuery}
                selectedId={selectedPerson}
                onFilter={setListFilter}
                onShowAll={() => {
                  setListFilter("everyone");
                  setListQuery("");
                }}
                onPerson={(id) => setSelection({ kind: "person", id })}
                onOpenSheet={(sheetId, personId) => {
                  setSelection({ kind: "person", id: personId });
                  openSheet(sheetId);
                }}
              />
            ) : (
              // Nothing for the moment before ★ Everyone's view is chosen, rather than a Tree that a
              // phone's List would replace.
              (!everyone || shownView) && (
                <FamilyCanvas
                  view={view}
                  sheetId={everyone ? EVERYONE : current.id}
                  focus={focus}
                  captureRef={capture}
                  actions={{
                    onPerson: (id) => setSelection({ kind: "person", id }),
                    onCouple: (id) => setSelection({ kind: "couple", id }),
                    selectedId: selection?.id,
                  }}
                />
              )
            )}
            {chat && (
              // Below 1024 px; above React Flow's credit in the corner.
              <button
                type="button"
                aria-label="Ask AI"
                aria-expanded={chatOpen}
                onClick={() => setChatOpen(!chatOpen)}
                className="absolute bottom-9 right-3 z-10 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white shadow-lg lg:hidden dark:bg-white dark:text-zinc-900"
              >
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
                </svg>
                AI
              </button>
            )}
          </div>
          {person && (
            <PersonPanel
              key={person.id}
              person={person}
              onDelete={deletePerson}
              signPhotoUpload={cloudName ? () => signPhotoUploadAction(groupId) : undefined}
              currentSheetId={everyone ? EVERYONE : current.id}
              onOpenSheet={openSheet}
              onFindInList={listShown ? undefined : () => findInList(person.id)}
              {...panelProps}
            />
          )}
          {couple && <CouplePanel key={couple.id} union={couple} {...panelProps} />}
          {importOpen && (
            <aside aria-label="Import" className={`${widePanel} overflow-y-auto p-4`}>
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
      </PhotosHiddenContext>
    </CloudNameContext>
  );
}
