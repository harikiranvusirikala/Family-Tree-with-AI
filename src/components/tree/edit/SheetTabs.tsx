"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Operation } from "@/server/operations/schema";
import { deleteSheetOps, moveSheetOps, newSheetOps, updateSheetOps } from "@/tree/edits";
import type { GroupTree, NamedSheet } from "@/tree/types";
import { nameWithYears } from "./PersonPanel";

const input = "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const small = "rounded px-2 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 pointer-coarse:min-h-11 dark:hover:bg-zinc-800";
/** An item in the sheet menu (below 1024 px), and a heading over a group of them. */
export const sheetMenuItem = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 disabled:opacity-50 pointer-coarse:min-h-11 dark:hover:bg-zinc-800";
export const sheetMenuHeading = "px-2 pt-2 text-xs text-zinc-500 dark:text-zinc-400";

/**
 * The sheet tabs (F5), plus for Maintain and up: "+ New sheet", and the current tab's menu to rename,
 * pin, move or delete it. Buttons rather than drag-and-drop, so they work from the keyboard. `trailing` goes at
 * the right end of the row (Export, Ask AI…).
 *
 * Below 1024 px (an owner request after the final check) the row keeps only the sheets and one menu
 * (⋯, "Sheet menu"), which holds the sheet's options and `menuItems` (the trailing tools as menu items).
 * Phones get a sheet picker instead of tabs.
 */
export function SheetTabs({
  tree,
  sheets,
  current,
  canEdit,
  pending,
  run,
  onOpen,
  trailing,
  menuItems,
}: {
  tree: GroupTree;
  sheets: NamedSheet[]; // in tab order
  current: NamedSheet;
  canEdit: boolean;
  pending: boolean;
  run: (ops: Operation[]) => Promise<Record<string, string> | null>;
  onOpen: (sheetId: string) => void;
  trailing?: ReactNode;
  menuItems?: ReactNode;
}) {
  const [tool, setTool] = useState<"menu" | "more" | "rename" | "new" | "delete" | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const people = [...tree.persons].sort((a, b) => a.name.localeCompare(b.name) || (a.birthYear ?? 0) - (b.birthYear ?? 0));
  const [rootId, setRootId] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);

  const close = () => {
    setTool(null);
    setFormError(null);
  };
  const runThenClose = async (ops: Operation[] | null) => {
    if (ops?.length === 0) return close(); // nothing changed
    if (ops && (await run(ops))) close();
  };
  /** Menu items close the menu at once; the change shows when saved, and errors appear above the canvas. */
  const runFromMenu = (ops: Operation[] | null) => {
    close();
    if (ops) void run(ops);
  };
  const left = moveSheetOps(sheets, current.id, -1);
  const right = moveSheetOps(sheets, current.id, 1);
  /** Why this sheet can't be deleted, if it can't. */
  const refusal = current.pinned
    ? `${current.title} is pinned, like the father's and mother's sheets, so it can't be deleted. Unpin it first.`
    : sheets.length === 1
      ? "A group needs at least one sheet."
      : null;

  /** The page then shows the first sheet left, as for any sheet that's gone. */
  async function deleteSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runThenClose(deleteSheetOps(current.id));
  }

  function openNew() {
    setRootId("");
    setTitle("");
    setTitleEdited(false);
    setFormError(null);
    setTool("new");
  }

  // The sheet menu closes on a tap outside it or Escape. Pointer events: React Flow stops the mouse
  // events a browser makes up after a touch on the canvas.
  useEffect(() => {
    if (tool !== "more") return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !bar.current?.contains(event.target as Node)) setTool(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [tool]);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    if (!next || next.length > 120) return setFormError("Enter a title of up to 120 characters.");
    await runThenClose(next === current.title ? [] : updateSheetOps(current.id, { title: next }));
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rootId) return setFormError("Choose the person the sheet is about.");
    if (!title.trim() || title.trim().length > 120) return setFormError("Enter a title of up to 120 characters.");
    const idMap = await run(newSheetOps(rootId, title.trim()));
    if (idMap) {
      close();
      onOpen(idMap["new:sheet"]);
    }
  }

  return (
    <div ref={bar} className="relative border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-1 pr-2 md:items-end lg:gap-2 lg:pr-4">
        {/* Only the tabs scroll sideways: a scrolling box also cuts off what hangs below it, like a menu. */}
        <div className="hidden min-w-0 flex-1 items-end gap-1 overflow-x-auto pl-4 pt-2 md:flex">
          <div role="tablist" aria-label="Sheets" className="flex gap-1">
            {sheets.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === current.id}
                onClick={() => onOpen(s.id)}
                className="flex shrink-0 items-center gap-1 rounded-t-md border border-b-0 border-transparent px-3 py-1.5 text-sm text-zinc-600 pointer-coarse:py-3 hover:text-zinc-900 aria-selected:border-zinc-200 aria-selected:bg-white aria-selected:font-medium aria-selected:text-zinc-900 dark:aria-selected:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-selected:bg-zinc-900 dark:aria-selected:text-zinc-100"
              >
                {s.pinned && (
                  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" className="fill-zinc-400">
                    <path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z" />
                  </svg>
                )}
                {s.title}
              </button>
            ))}
          </div>
          {canEdit && (
            <div className="mb-1 hidden shrink-0 gap-1 lg:flex">
              <button type="button" aria-label="Sheet options" aria-haspopup="menu" aria-expanded={tool === "menu"} onClick={() => (tool === "menu" ? close() : setTool("menu"))} className={small}>
                ⋯
              </button>
              <button type="button" onClick={openNew} className={small}>
                + New sheet
              </button>
            </div>
          )}
        </div>
        <SheetPicker sheets={sheets} current={current} onOpen={onOpen} />
        <button
          type="button"
          aria-label="Sheet menu"
          aria-haspopup="menu"
          aria-expanded={tool === "more"}
          onClick={() => (tool === "more" ? close() : setTool("more"))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg hover:bg-zinc-100 aria-expanded:bg-zinc-100 md:mb-1 lg:hidden pointer-coarse:h-11 pointer-coarse:w-11 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800"
        >
          ⋯
        </button>
        {trailing && <div className="mb-1 hidden shrink-0 pt-2 lg:block">{trailing}</div>}
      </div>

      {tool === "more" && (
        // Any item closes the menu; a form it opens (Rename, New sheet, Delete) then shows below the row.
        <div
          role="menu"
          aria-label="Sheet menu"
          onClick={(event) => {
            if ((event.target as Element).closest("button, a")) setTool((t) => (t === "more" ? null : t));
          }}
          className="absolute inset-x-0 top-full z-30 flex max-h-[70dvh] flex-col gap-0.5 overflow-y-auto border-b border-zinc-200 bg-white p-2 text-sm text-zinc-900 shadow-lg md:left-auto md:w-80 md:rounded-bl-lg md:border-l lg:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {canEdit && (
            <>
              <p className={sheetMenuHeading}>{current.title}</p>
              <div className="flex flex-wrap gap-1">
                <button type="button" role="menuitem" onClick={() => setTool("rename")} className={small}>
                  Rename
                </button>
                <button type="button" role="menuitem" disabled={pending} onClick={() => runFromMenu(updateSheetOps(current.id, { pinned: !current.pinned }))} className={small}>
                  {current.pinned ? "Unpin" : "Pin"}
                </button>
                {/* Up and down in a phone's sheet picker, left and right in a tablet's tabs. */}
                <button type="button" role="menuitem" disabled={pending || !left} onClick={() => runFromMenu(left)} className={small}>
                  <span className="md:hidden">Move up</span>
                  <span className="hidden md:inline">Move left</span>
                </button>
                <button type="button" role="menuitem" disabled={pending || !right} onClick={() => runFromMenu(right)} className={small}>
                  <span className="md:hidden">Move down</span>
                  <span className="hidden md:inline">Move right</span>
                </button>
                <button type="button" role="menuitem" onClick={() => setTool("delete")} className={`${small} text-red-700 dark:text-red-400`}>
                  Delete sheet
                </button>
              </div>
              <button type="button" role="menuitem" onClick={openNew} className={sheetMenuItem}>
                + New sheet
              </button>
            </>
          )}
          {menuItems}
        </div>
      )}

      {tool === "menu" && (
        <div role="menu" aria-label="Sheet options" className="flex flex-wrap gap-1 px-4 py-2 text-sm">
          <span className="self-center pr-2 text-zinc-500 dark:text-zinc-400">{current.title}:</span>
          <button type="button" role="menuitem" onClick={() => setTool("rename")} className={small}>
            Rename
          </button>
          <button type="button" role="menuitem" disabled={pending} onClick={() => runFromMenu(updateSheetOps(current.id, { pinned: !current.pinned }))} className={small}>
            {current.pinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" role="menuitem" disabled={pending || !left} onClick={() => runFromMenu(left)} className={small}>
            Move left
          </button>
          <button type="button" role="menuitem" disabled={pending || !right} onClick={() => runFromMenu(right)} className={small}>
            Move right
          </button>
          <button type="button" role="menuitem" onClick={() => setTool("delete")} className={`${small} text-red-700 dark:text-red-400`}>
            Delete sheet
          </button>
        </div>
      )}

      {tool === "delete" && (
        // Pinned sheets (the father's and mother's) and the last sheet can't go; the server says the same.
        <form aria-label="Delete sheet" onSubmit={deleteSheet} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
          {refusal ? (
            <p>{refusal}</p>
          ) : (
            <>
              <p>Delete the sheet {current.title}? Everyone on it stays in the family.</p>
              <button type="submit" disabled={pending} className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-red-500 dark:text-zinc-950">
                {pending ? "Deleting…" : "Delete sheet"}
              </button>
            </>
          )}
          <button type="button" onClick={close} className={small}>
            {refusal ? "Close" : "Cancel"}
          </button>
        </form>
      )}

      {tool === "rename" && (
        <form aria-label="Rename sheet" onSubmit={rename} className="flex flex-wrap items-end gap-2 px-4 py-2">
          <label className="flex min-w-64 flex-col gap-1 text-sm font-medium">
            Sheet title
            <input name="title" defaultValue={current.title} maxLength={120} className={input} />
          </label>
          <button type="submit" disabled={pending} className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
            Save
          </button>
          <button type="button" onClick={close} className={small}>
            Cancel
          </button>
        </form>
      )}

      {tool === "new" && (
        <form aria-label="New sheet" onSubmit={create} className="flex flex-wrap items-end gap-2 px-4 py-2">
          <label className="flex min-w-56 flex-col gap-1 text-sm font-medium">
            Person
            <select
              value={rootId}
              onChange={(e) => {
                setRootId(e.target.value);
                const person = people.find((p) => p.id === e.target.value);
                if (person && !titleEdited) setTitle(`${person.name}'s family`);
              }}
              className={input}
            >
              <option value="">Choose someone…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameWithYears(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-56 flex-col gap-1 text-sm font-medium">
            Title
            <input
              value={title}
              maxLength={120}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleEdited(true);
              }}
              className={input}
            />
          </label>
          <button type="submit" disabled={pending} className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
            {pending ? "Creating…" : "Create sheet"}
          </button>
          <button type="button" onClick={close} className={small}>
            Cancel
          </button>
        </form>
      )}

      {formError && (
        <p role="alert" className="px-4 pb-2 text-sm text-red-700 dark:text-red-400">
          {formError}
        </p>
      )}
    </div>
  );
}

/**
 * Phones: the sheets as a picker (decided by the owner) instead of tabs, which would show about two at
 * a time. The device's own list opens, so every title can be read in full; pinned sheets come first.
 */
function SheetPicker({ sheets, current, onOpen }: { sheets: NamedSheet[]; current: NamedSheet; onOpen: (sheetId: string) => void }) {
  const option = (s: NamedSheet) => (
    <option key={s.id} value={s.id}>
      {s.title}
    </option>
  );
  const pinned = sheets.filter((s) => s.pinned);
  const others = sheets.filter((s) => !s.pinned);
  return (
    <div className="relative min-w-0 flex-1 py-1.5 pl-3 md:hidden">
      <select
        aria-label="Sheet"
        value={current.id}
        onChange={(event) => onOpen(event.target.value)}
        className="h-10 w-full appearance-none truncate rounded-lg border border-zinc-300 bg-white pl-3 pr-9 text-sm font-medium pointer-coarse:h-11 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {pinned.length && others.length ? (
          <>
            <optgroup label="Pinned">{pinned.map(option)}</optgroup>
            <optgroup label="Other sheets">{others.map(option)}</optgroup>
          </>
        ) : (
          sheets.map(option)
        )}
      </select>
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
