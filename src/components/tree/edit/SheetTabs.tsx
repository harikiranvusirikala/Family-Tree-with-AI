"use client";

import { useState, type FormEvent } from "react";
import type { Operation } from "@/server/operations/schema";
import { moveSheetOps, newSheetOps, updateSheetOps } from "@/tree/edits";
import type { GroupTree, NamedSheet } from "@/tree/types";
import { nameWithYears } from "./PersonPanel";

const input = "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const small = "rounded px-2 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800";

/**
 * The sheet tabs (F5), plus for Maintain and up: "+ New sheet", and the current tab's menu to rename,
 * pin or move it. Buttons rather than drag-and-drop, so they work from the keyboard.
 */
export function SheetTabs({
  tree,
  sheets,
  current,
  canEdit,
  pending,
  run,
  onOpen,
}: {
  tree: GroupTree;
  sheets: NamedSheet[]; // in tab order
  current: NamedSheet;
  canEdit: boolean;
  pending: boolean;
  run: (ops: Operation[]) => Promise<Record<string, string> | null>;
  onOpen: (sheetId: string) => void;
}) {
  const [tool, setTool] = useState<"menu" | "rename" | "new" | null>(null);
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

  function openNew() {
    setRootId("");
    setTitle("");
    setTitleEdited(false);
    setFormError(null);
    setTool("new");
  }

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
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-end gap-1 overflow-x-auto px-4 pt-2">
        <div role="tablist" aria-label="Sheets" className="flex gap-1">
          {sheets.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === current.id}
              onClick={() => onOpen(s.id)}
              className="flex shrink-0 items-center gap-1 rounded-t-md border border-b-0 border-transparent px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 aria-selected:border-zinc-200 aria-selected:bg-white aria-selected:font-medium aria-selected:text-zinc-900 dark:aria-selected:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-selected:bg-zinc-900 dark:aria-selected:text-zinc-100"
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
          <div className="mb-1 flex shrink-0 gap-1">
            <button type="button" aria-label="Sheet options" aria-haspopup="menu" aria-expanded={tool === "menu"} onClick={() => (tool === "menu" ? close() : setTool("menu"))} className={small}>
              ⋯
            </button>
            <button type="button" onClick={openNew} className={small}>
              + New sheet
            </button>
          </div>
        )}
      </div>

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
        </div>
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
