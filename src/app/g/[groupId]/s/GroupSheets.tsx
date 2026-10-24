"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ExportItems, ExportMenu } from "@/components/import-export/ExportMenu";
import { ImportPanel } from "@/components/import-export/ImportPanel";
import { isPhone } from "@/components/screen";
import { useToday } from "@/components/today";
import { EveryoneList } from "@/components/tree/EveryoneList";
import { FamilyCanvas, type CanvasFocus, type CapturePicture } from "@/components/tree/FamilyCanvas";
import { FindSomeone } from "@/components/tree/FindSomeone";
import { setNameStyle, useNameStyle } from "@/components/tree/name-style";
import { NetworkCanvas } from "@/components/tree/NetworkCanvas";
import { UpcomingList } from "@/components/tree/UpcomingList";
import { ViewSwitcher } from "@/components/tree/ViewSwitcher";
import { WheelCanvas } from "@/components/tree/WheelCanvas";
import { downloadPicture, printPicture } from "@/components/tree/sheet-picture";
import { fileName } from "@/server/import-export/types";
import { CouplePanel } from "@/components/tree/edit/CouplePanel";
import { PersonPanel } from "@/components/tree/edit/PersonPanel";
import { widePanel } from "@/components/tree/edit/panel";
import { SheetTabs, sheetMenuHeading, sheetMenuItem } from "@/components/tree/edit/SheetTabs";
import { HidePhotosButton } from "@/components/tree/HidePhotosButton";
import { button } from "@/components/ui/button";
import { GradientSparkle } from "@/components/ui/GradientSparkle";
import { Toast, toastAction } from "@/components/ui/Toast";
import { searchField, searchIcon } from "@/components/ui/field";
import { LineIcon } from "@/components/ui/icons";
import { CloudNameContext, PhotosHiddenContext } from "@/components/tree/photo";
import type { Operation } from "@/server/operations/schema";
import { deletePersonOps, restorePersonOps, tabOrder } from "@/tree/edits";
import { chooseView, EVERYONE, everyoneHref, everyoneView, isEveryoneView, listRows, type EveryoneViewName, type ListFilter, type ListSort } from "@/tree/everyone";
import { kinship, relationName, relationPath } from "@/tree/kinship";
import { buildSheetView } from "@/tree/sheet-view";
import type { GroupTree, Person } from "@/tree/types";
import { applyChangesAction, signPhotoUploadAction } from "../actions";

type Selection = { kind: "person" | "couple"; id: string } | null;

const UNDO_SECONDS = 10;
/** How long "Saved." stays. */
const SAVED_SECONDS = 2.5;

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
  const drawn = !everyone || (shownView !== "list" && shownView !== "upcoming"); // something to picture
  const listShown = everyone && shownView === "list";
  const upcomingShown = everyone && shownView === "upcoming";
  const today = useToday(); // the device's day, once the page is in the browser
  const networkShown = everyone && shownView === "network";
  const wheelShown = everyone && shownView === "wheel";
  const rows = useMemo(() => (listShown ? listRows(tree) : []), [listShown, tree]);
  const [listFilter, setListFilter] = useState<ListFilter>("everyone");
  const [listQuery, setListQuery] = useState("");
  const [listSort, setListSort] = useState<ListSort>("name"); // A to Z until a date order is chosen

  const [selection, setSelection] = useState<Selection>(() => {
    const id = everyone ? searchParams.get("person") : null;
    return id && tree.persons.some((p) => p.id === id) ? { kind: "person", id } : null;
  });
  const selectedPerson = selection?.kind === "person" ? selection.id : undefined;
  // The Wheel's middle lives in the address only (`&centre=`), set by every way into the Wheel; it stays
  // put while people are selected there. Without one (an older link): whoever is selected, else the
  // first sheet's root, until the effect below writes it in.
  const addressCentre = everyone ? searchParams.get("centre") : null;
  const wheelCentre = addressCentre && tree.persons.some((p) => p.id === addressCentre) ? addressCentre : (selectedPerson ?? view.rootPersonId);
  const kin = useMemo(() => (wheelShown && wheelCentre ? kinship(tree, wheelCentre) : null), [wheelShown, wheelCentre, tree]);
  const nameStyle = useNameStyle();
  const [deleted, setDeleted] = useState<Person | null>(null); // for Undo
  const [saved, setSaved] = useState(0); // counts saves: each one shows "Saved." for its own moment
  const [savedShown, setSavedShown] = useState(false);
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

  /** Export, picture (F9): the whole sheet, then a download or the print dialog. */
  async function picture(then: (picture: Blob) => void) {
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

  // ★ Everyone's address follows the selected person. Opened without a view (a link from before the
  // List): the one last used on this device, else List on a phone and Network elsewhere; the Wheel without
  // a middle gets one. It reads the view and the middle from the live address, not from this render:
  // a view or middle just pushed may not have reached useSearchParams yet, and mustn't be undone.
  useEffect(() => {
    if (!everyone) return;
    const live = new URLSearchParams(window.location.search);
    const liveView = live.get("view");
    const shown = isEveryoneView(liveView) ? liveView : chooseView(null, savedView(), isPhone());
    const href = everyoneHref(groupId, shown, selectedPerson, live.get("centre") ?? wheelCentre);
    if (href !== window.location.pathname + window.location.search) window.history.replaceState(null, "", href);
  }, [everyone, shownView, selectedPerson, wheelCentre, groupId]);

  useEffect(() => {
    if (!shownView) return;
    try {
      localStorage.setItem(VIEW_KEY, shownView);
    } catch {
      // storage blocked: the device's first view next time
    }
  }, [shownView]);

  function openSheet(sheetId: string) {
    if (sheetId !== EVERYONE) return window.history.pushState(null, "", `/g/${groupId}/s/${sheetId}`);
    const next = chooseView(null, savedView(), isPhone());
    window.history.pushState(null, "", everyoneHref(groupId, next, selectedPerson, selectedPerson ?? wheelCentre));
  }

  /** The view switcher. Back returns to the view before, as with tabs. The Wheel opens around whoever is selected. */
  function showView(next: EveryoneViewName) {
    if (next === shownView) return;
    setFocus((next === "tree" || next === "network") && selectedPerson ? { personId: selectedPerson } : null); // they open at them
    window.history.pushState(null, "", everyoneHref(groupId, next, selectedPerson, selectedPerson ?? wheelCentre));
  }

  /**
   * The Wheel around someone: the panel's Relatives wheel and Put in the middle, and Find someone in the
   * Wheel. A new history entry, so Back returns to the middle before.
   */
  function showWheel(personId: string) {
    window.history.pushState(null, "", everyoneHref(groupId, "wheel", personId, personId));
  }

  /** The panel's Find in list: the List, showing everyone, with their row in view. */
  function findInList(personId: string) {
    setListFilter("everyone");
    setListQuery("");
    window.history.pushState(null, "", everyoneHref(groupId, "list", personId));
  }

  /** The panel's Show in network: the Network, centred on them. */
  function showInNetwork(personId: string) {
    setFocus({ personId });
    window.history.pushState(null, "", everyoneHref(groupId, "network", personId));
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
        } else {
          setSaved((n) => n + 1);
          setSavedShown(true);
          resolve(result.idMap);
        }
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

  // "Saved." after a change, for a moment (the production look). A deletion's toast, with Undo, replaces it.
  useEffect(() => {
    if (!savedShown) return;
    const timer = setTimeout(() => setSavedShown(false), SAVED_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [saved, savedShown]);

  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(null), UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [deleted]);

  const person = selection?.kind === "person" ? tree.persons.find((p) => p.id === selection.id) : undefined;
  const couple = selection?.kind === "couple" ? tree.unions.find((u) => u.id === selection.id) : undefined;
  // The List and Upcoming draw no tree, so they have only the data to export (Maintain and up).
  const exportable = drawn || canEdit;
  const pictureTitle = kin ? `${kin.centre.name}'s relatives` : networkShown ? "Everyone network" : everyone ? "Everyone" : current.title;
  // In the Wheel, the panel says how the selected person is related to the one in the middle.
  const kinOfSelected = kin && person ? kin.relatives.find((r) => r.person.id === person.id) : undefined;
  const relation =
    kin && person
      ? person.id === kin.centre.id
        ? { names: null, path: "" }
        : kinOfSelected
          ? {
              names: `${relationName(kin.centre, kinOfSelected.path, "te")} · ${relationName(kin.centre, kinOfSelected.path, "en")}`,
              path: `${kin.centre.name}'s ${relationPath(kin.centre, kinOfSelected.path)}`,
              onMiddle: () => showWheel(person.id),
            }
          : { names: "Not related through anyone", path: `to ${kin.centre.name}`, onMiddle: () => showWheel(person.id) }
      : undefined;
  const exportProps = {
    groupId,
    sheetId: everyone ? undefined : current.id,
    canExportData: canEdit,
    onPicture: drawn ? () => picture((png) => downloadPicture(png, fileName(pictureTitle))) : undefined,
    onPrint: drawn ? () => picture((png) => printPicture(png, pictureTitle)) : undefined,
  };
  const canvasActions = {
    onPerson: (id: string) => setSelection({ kind: "person", id }),
    onCouple: (id: string) => setSelection({ kind: "couple", id }),
    selectedId: selection?.id,
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
          beforeMenu={cloudName && <HidePhotosButton hidden={photosHidden} onToggle={() => setPhotosHidden(!photosHidden)} />}
          menuItems={
            exportable && (
              <>
                <p className={sheetMenuHeading}>Export</p>
                <ExportItems {...exportProps} itemClass={sheetMenuItem} headings={false} />
                {canEdit && (
                  <button type="button" role="menuitem" onClick={() => setImportOpen(true)} className={sheetMenuItem}>
                    <LineIcon name="upload" className="size-4 shrink-0" />
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
                  className={`${button("secondary")} aria-expanded:bg-zinc-100 dark:aria-expanded:bg-zinc-800`}
                >
                  <LineIcon name="upload" className="size-4" />
                  Import…
                </button>
              )}
              {chat && (
                // The main button, with the gradient's other use: its sparkle (the production look).
                <button
                  type="button"
                  aria-expanded={chatOpen}
                  onClick={() => setChatOpen(!chatOpen)}
                  className={`${button("primary")} aria-expanded:ring-2 aria-expanded:ring-blue-400/60`}
                >
                  <GradientSparkle />
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-200 bg-white px-3 py-2 md:px-4 dark:border-zinc-800 dark:bg-zinc-950">
            <ViewSwitcher shown={shownView} onShow={showView} />
            {wheelShown && (
              // The Wheel's relation names: Telugu names in English letters, or English (the owner's choice).
              <div role="group" aria-label="Relation names" className="flex shrink-0 gap-0.5 rounded-xl bg-zinc-100 p-1 text-sm font-medium dark:bg-zinc-900">
                {(
                  [
                    ["te", "తె", "Telugu names"],
                    ["en", "En", "English names"],
                  ] as const
                ).map(([style, label, name]) => (
                  <button
                    key={style}
                    type="button"
                    aria-label={name}
                    aria-pressed={nameStyle === style}
                    onClick={() => setNameStyle(style)}
                    className="rounded-lg px-3 py-1 text-zinc-600 outline-none hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500/70 aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-sm pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-pressed:bg-zinc-800 dark:aria-pressed:text-zinc-100"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <p className="hidden shrink-0 text-sm text-zinc-500 sm:block dark:text-zinc-400">
              {view.persons.length} {view.persons.length === 1 ? "person" : "people"} · {couples} {couples === 1 ? "couple" : "couples"}
            </p>
            <div className="relative w-full sm:ml-auto sm:w-72">
              {listShown ? (
                // In the List, Find someone narrows the rows as you type (the owner's choice).
                <>
                  <input
                    type="search"
                    aria-label="Find someone"
                    placeholder="Find someone…"
                    value={listQuery}
                    onChange={(event) => setListQuery(event.target.value)}
                    className={searchField}
                  />
                  <LineIcon name="search" className={searchIcon} />
                </>
              ) : (
                <FindSomeone
                  persons={view.persons}
                  onChoose={(id) => {
                    setSelection({ kind: "person", id });
                    setFocus({ personId: id });
                    if (wheelShown) showWheel(id); // in the Wheel: put them in the middle
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
                sort={listSort}
                selectedId={selectedPerson}
                onFilter={setListFilter}
                onSort={setListSort}
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
            ) : upcomingShown ? (
              today && (
                <UpcomingList
                  family={tree}
                  today={today}
                  selectedId={selection?.id}
                  onPerson={(id) => setSelection({ kind: "person", id })}
                  onCouple={(id) => setSelection({ kind: "couple", id })}
                />
              )
            ) : kin ? (
              <WheelCanvas kin={kin} style={nameStyle} captureRef={capture} actions={canvasActions} />
            ) : networkShown ? (
              <NetworkCanvas tree={tree} rootPersonId={view.rootPersonId} focus={focus} captureRef={capture} actions={canvasActions} />
            ) : (
              // Nothing for the moment before ★ Everyone's view is chosen, rather than a Tree that a
              // phone's List would replace.
              (!everyone || shownView) && <FamilyCanvas view={view} sheetId={everyone ? EVERYONE : current.id} focus={focus} captureRef={capture} actions={canvasActions} />
            )}
            {chat && (
              // Below 1024 px; above React Flow's credit in the corner.
              <button
                type="button"
                aria-label="Ask AI"
                aria-expanded={chatOpen}
                onClick={() => setChatOpen(!chatOpen)}
                className="absolute right-3 bottom-9 z-10 flex size-14 flex-col items-center justify-center gap-0.5 rounded-full bg-zinc-900 text-[11px] font-semibold text-white shadow-lg shadow-zinc-900/25 lg:hidden dark:bg-white dark:text-zinc-900 dark:shadow-black/50"
              >
                <GradientSparkle className="size-5" />
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
              onShowInNetwork={networkShown ? undefined : () => showInNetwork(person.id)}
              onShowWheel={wheelShown ? undefined : () => showWheel(person.id)}
              relation={relation}
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
          {deleted ? (
            <Toast className="absolute inset-x-0 top-3 z-30">
              <span>{deleted.name} deleted.</span>
              <button type="button" onClick={undoDelete} disabled={pending} className={toastAction}>
                Undo
              </button>
            </Toast>
          ) : (
            savedShown && (
              <Toast className="absolute inset-x-0 top-3 z-30">
                <LineIcon name="check" className="size-4" />
                Saved.
              </Toast>
            )
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
