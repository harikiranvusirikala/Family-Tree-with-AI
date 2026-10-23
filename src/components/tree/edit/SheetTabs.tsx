"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { button, iconButton } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { field, fieldLabel, formError as formErrorClass } from "@/components/ui/field";
import { LineIcon } from "@/components/ui/icons";
import { dangerMenuItem, Menu, MenuLabel, MenuSeparator, menuItem } from "@/components/ui/Menu";
import type { Operation } from "@/server/operations/schema";
import { deleteSheetOps, moveSheetOps, newSheetOps, updateSheetOps } from "@/tree/edits";
import { EVERYONE } from "@/tree/everyone";
import type { GroupTree, NamedSheet } from "@/tree/types";
import { nameWithYears } from "./PersonPanel";

/** An item in the sheet menu (below 1024 px), and a heading over a group of them: the app's menu items. */
export const sheetMenuItem = menuItem;
export const sheetMenuHeading = "px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400";

/** The tabs as a segmented control (the production look): the open one raised in white. */
const tabClass =
  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-sm font-medium text-zinc-600 outline-none hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500/70 aria-selected:bg-white aria-selected:text-zinc-900 aria-selected:shadow-sm pointer-coarse:py-2.5 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-selected:bg-zinc-800 dark:aria-selected:text-zinc-100";
const icon = "size-4 shrink-0";

type SheetDialog = "rename" | "new" | "delete";

/**
 * The sheet tabs (F5), plus for Maintain and up: New sheet, and the open sheet's menu to rename, pin,
 * move or delete it. Buttons rather than drag-and-drop, so they work from the keyboard. Renaming, a new
 * sheet and deleting open dialogs (the production look); their errors appear above the canvas, like the
 * menu's. `trailing` goes at the right end of the row (Export, Ask AI…).
 *
 * Below 1024 px (an owner request after the final check) the row keeps only the sheets, `beforeMenu`
 * (the eye that hides photos) and one menu (⋯, "Sheet menu"), which holds the sheet's options and
 * `menuItems` (the other trailing tools as menu items, closing it when chosen). Phones get a sheet
 * picker instead of tabs.
 *
 * ★ Everyone (an owner request after the final check) comes first, before the pinned sheets; `onOpen`
 * gets EVERYONE for it. While it's open (`everyone`) there's no sheet to rename, pin, move or delete, so
 * those options are left out; `current` is then just the first sheet.
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
  beforeMenu,
  menuItems,
  everyone = false,
}: {
  tree: GroupTree;
  sheets: NamedSheet[]; // in tab order
  current: NamedSheet;
  canEdit: boolean;
  pending: boolean;
  run: (ops: Operation[]) => Promise<Record<string, string> | null>;
  onOpen: (sheetId: string) => void;
  trailing?: ReactNode;
  beforeMenu?: ReactNode;
  menuItems?: ReactNode;
  everyone?: boolean;
}) {
  const [dialog, setDialog] = useState<SheetDialog | null>(null);
  const tabRow = useRef<HTMLDivElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const people = [...tree.persons].sort((a, b) => a.name.localeCompare(b.name) || (a.birthYear ?? 0) - (b.birthYear ?? 0));
  const [rootId, setRootId] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);

  useLayoutEffect(() => () => setDialog(null), []); // its page hidden (kept for Back): closed when it comes back

  const options = canEdit && !everyone; // the open sheet's own: rename, pin, move, delete
  const left = moveSheetOps(sheets, current.id, -1);
  const right = moveSheetOps(sheets, current.id, 1);
  /** Why this sheet can't be deleted, if it can't. */
  const refusal = current.pinned
    ? `${current.title} is pinned, like the father's and mother's sheets, so it can't be deleted. Unpin it first.`
    : sheets.length === 1
      ? "A group needs at least one sheet."
      : null;

  const open = (next: SheetDialog) => {
    setFormError(null);
    setDialog(next);
  };
  const closeDialog = () => {
    setDialog(null);
    setFormError(null);
  };
  /** Saves, then closes the dialog: the change shows when saved, and an error appears above the canvas. */
  const save = async (ops: Operation[]) => {
    if (ops.length) await run(ops);
    closeDialog();
  };
  /** Menu items close the menu at once; the change shows when saved, and errors appear above the canvas. */
  const runFromMenu = (close: () => void, ops: Operation[] | null) => {
    close();
    if (ops) void run(ops);
  };

  function openNew() {
    setRootId("");
    setTitle("");
    setTitleEdited(false);
    open("new");
  }

  // The tab row scrolls sideways with no scrollbar (it covered the names; an owner request after the
  // final check), so a mouse wheel scrolls it too. Trackpads already scroll it sideways themselves.
  useEffect(() => {
    const row = tabRow.current;
    if (!row) return;
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || row.scrollWidth <= row.clientWidth) return;
      event.preventDefault();
      row.scrollLeft += event.deltaY;
    };
    row.addEventListener("wheel", wheel, { passive: false }); // React's onWheel can't prevent the default
    return () => row.removeEventListener("wheel", wheel);
  }, []);

  // The open sheet's tab is scrolled into view: on opening the page, and when "Go to" opens a far tab.
  useEffect(() => {
    const row = tabRow.current;
    const tab = row?.querySelector('[role="tab"][aria-selected="true"]');
    if (!row || !tab) return;
    const [r, t] = [row.getBoundingClientRect(), tab.getBoundingClientRect()];
    if (t.left < r.left) row.scrollLeft -= r.left - t.left + 16;
    else if (t.right > r.right) row.scrollLeft += t.right - r.right + 16;
  }, [current.id, everyone]);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    if (!next || next.length > 120) return setFormError("Enter a title of up to 120 characters.");
    await save(next === current.title ? [] : updateSheetOps(current.id, { title: next }));
  }

  /** The page then shows the first sheet left, as for any sheet that's gone. */
  async function deleteSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save(deleteSheetOps(current.id));
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rootId) return setFormError("Choose the person the sheet is about.");
    if (!title.trim() || title.trim().length > 120) return setFormError("Enter a title of up to 120 characters.");
    const idMap = await run(newSheetOps(rootId, title.trim()));
    closeDialog();
    if (idMap) onOpen(idMap["new:sheet"]);
  }

  /** The open sheet's options, in the ⋯ menu (computers) or the sheet menu. Up and down beside a phone's picker. */
  const optionItems = (close: () => void) => (
    <>
      <MenuLabel>
        <span className="block truncate">{current.title}</span>
      </MenuLabel>
      <button type="button" role="menuitem" onClick={() => (close(), open("rename"))} className={menuItem}>
        <LineIcon name="pencil" className={icon} />
        Rename…
      </button>
      <button type="button" role="menuitem" disabled={pending} onClick={() => runFromMenu(close, updateSheetOps(current.id, { pinned: !current.pinned }))} className={menuItem}>
        <LineIcon name="pin" className={icon} />
        {current.pinned ? "Unpin" : "Pin"}
      </button>
      <button type="button" role="menuitem" disabled={pending || !left} onClick={() => runFromMenu(close, left)} className={menuItem}>
        <LineIcon name="arrowLeft" className={`${icon} max-md:rotate-90`} />
        <span className="md:hidden">Move up</span>
        <span className="hidden md:inline">Move left</span>
      </button>
      <button type="button" role="menuitem" disabled={pending || !right} onClick={() => runFromMenu(close, right)} className={menuItem}>
        <LineIcon name="arrowRight" className={`${icon} max-md:rotate-90`} />
        <span className="md:hidden">Move down</span>
        <span className="hidden md:inline">Move right</span>
      </button>
      <MenuSeparator />
      <button type="button" role="menuitem" onClick={() => (close(), open("delete"))} className={dangerMenuItem}>
        <LineIcon name="trash" className={icon} />
        Delete sheet…
      </button>
    </>
  );

  return (
    <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-1.5 py-1 pr-2 pl-3 md:gap-2 lg:pr-4 lg:pl-4">
        {/* Computers: the sheet's options (⋯) come first, before the pinned tabs, and stay put while the
            tabs scroll (the owner's choice). */}
        {options && (
          <div className="hidden shrink-0 lg:block">
            <Menu label="Sheet options" buttonLabel="Sheet options" align="start" buttonClassName={iconButton} button={<LineIcon name="more" className="size-5" />}>
              {optionItems}
            </Menu>
          </div>
        )}
        {/* Only the tabs scroll sideways: a scrolling box also cuts off what hangs below it, like a menu.
            The tab list never shrinks, and titles never wrap: otherwise Chrome shrinks the list to its
            narrowest size, the tabs spill out of it, and New sheet lands on the last ones (found by the
            owner with seven sheets). */}
        <div ref={tabRow} className="hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-none py-0.5 md:flex">
          <div role="tablist" aria-label="Sheets" className="flex shrink-0 items-center gap-0.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            <button type="button" role="tab" aria-selected={everyone} onClick={() => onOpen(EVERYONE)} className={tabClass}>
              ★ Everyone
            </button>
            {sheets.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={!everyone && s.id === current.id} onClick={() => onOpen(s.id)} className={tabClass}>
                {s.pinned && <LineIcon name="pin" className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />}
                {s.title}
              </button>
            ))}
          </div>
          {canEdit && (
            <div className="hidden shrink-0 lg:block">
              <button type="button" onClick={openNew} className={button("ghost", "sm")}>
                <LineIcon name="plus" className={icon} />
                New sheet
              </button>
            </div>
          )}
        </div>
        <SheetPicker sheets={sheets} current={everyone ? EVERYONE : current.id} onOpen={onOpen} />
        {beforeMenu && <div className="flex shrink-0 lg:hidden">{beforeMenu}</div>}
        {/* Not when it would be empty: a Viewer on ★ Everyone's List, which has nothing to export. */}
        {(canEdit || menuItems) && (
          <div className="shrink-0 lg:hidden">
            <Menu
              label="Sheet menu"
              buttonLabel="Sheet menu"
              align="end"
              menuClassName="w-72 max-h-[70dvh] overflow-y-auto overscroll-contain"
              buttonClassName={iconButton}
              button={<LineIcon name="more" className="size-6" />}
            >
              {(close) => (
                // Any item closes it, the page's tools too; a dialog it opens shows over the page.
                <div
                  onClick={(event) => {
                    if ((event.target as Element).closest('[role="menuitem"]')) close();
                  }}
                >
                  {options && (
                    <>
                      {optionItems(close)}
                      <MenuSeparator />
                    </>
                  )}
                  {canEdit && (
                    <button type="button" role="menuitem" onClick={() => (close(), openNew())} className={menuItem}>
                      <LineIcon name="plus" className={icon} />
                      New sheet
                    </button>
                  )}
                  {menuItems}
                </div>
              )}
            </Menu>
          </div>
        )}
        {trailing && <div className="hidden shrink-0 lg:block">{trailing}</div>}
      </div>

      <Dialog open={dialog === "rename" && options} onClose={closeDialog} title="Rename sheet">
        <form aria-label="Rename sheet" onSubmit={rename} className="flex flex-col gap-5">
          <label className={fieldLabel}>
            Sheet title
            <input name="title" defaultValue={current.title} maxLength={120} className={field} />
          </label>
          <Problem error={formError} />
          <DialogActions>
            <button type="button" onClick={closeDialog} className={button("ghost")}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={button("primary")}>
              {pending ? "Saving…" : "Save"}
            </button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={dialog === "new" && canEdit} onClose={closeDialog} title="New sheet" description="A tab around one person: their ancestors, all of those ancestors' descendants, and their partners.">
        <form aria-label="New sheet" onSubmit={create} className="flex flex-col gap-5">
          <label className={fieldLabel}>
            Person
            <select
              value={rootId}
              onChange={(e) => {
                setRootId(e.target.value);
                const person = people.find((p) => p.id === e.target.value);
                if (person && !titleEdited) setTitle(`${person.name}'s family`);
              }}
              className={field}
            >
              <option value="">Choose someone…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameWithYears(p)}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Title
            <input
              value={title}
              maxLength={120}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleEdited(true);
              }}
              className={field}
            />
          </label>
          <Problem error={formError} />
          <DialogActions>
            <button type="button" onClick={closeDialog} className={button("ghost")}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={button("primary")}>
              {pending ? "Creating…" : "Create sheet"}
            </button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Pinned sheets (the father's and mother's) and the last sheet can't go; the server says the same. */}
      <Dialog open={dialog === "delete" && options} onClose={closeDialog} title="Delete sheet">
        <form aria-label="Delete sheet" onSubmit={deleteSheet} className="flex flex-col gap-5">
          <p className="text-sm text-pretty text-zinc-700 dark:text-zinc-300">{refusal ?? `Delete the sheet ${current.title}? Everyone on it stays in the family.`}</p>
          <DialogActions>
            <button type="button" data-autofocus onClick={closeDialog} className={button(refusal ? "secondary" : "ghost")}>
              {refusal ? "Close" : "Cancel"}
            </button>
            {!refusal && (
              <button type="submit" disabled={pending} className={button("danger")}>
                {pending ? "Deleting…" : "Delete sheet"}
              </button>
            )}
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

function Problem({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className={formErrorClass}>
      {error}
    </p>
  ) : null;
}

/**
 * Phones: the sheets as a picker (decided by the owner) instead of tabs, which would show about two at
 * a time. The device's own list opens, so every title can be read in full; ★ Everyone first, then the
 * pinned sheets. `current`: the open sheet's id, or EVERYONE.
 */
function SheetPicker({ sheets, current, onOpen }: { sheets: NamedSheet[]; current: string; onOpen: (sheetId: string) => void }) {
  const option = (s: NamedSheet) => (
    <option key={s.id} value={s.id}>
      {s.title}
    </option>
  );
  const pinned = sheets.filter((s) => s.pinned);
  const others = sheets.filter((s) => !s.pinned);
  return (
    <div className="relative min-w-0 flex-1 md:hidden">
      <select
        aria-label="Sheet"
        value={current}
        onChange={(event) => onOpen(event.target.value)}
        className="h-10 w-full appearance-none truncate rounded-lg border border-zinc-300 bg-white pr-9 pl-3 text-sm font-medium text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-500/30 pointer-coarse:h-11 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <option value={EVERYONE}>★ Everyone</option>
        {pinned.length && others.length ? (
          <>
            <optgroup label="Pinned">{pinned.map(option)}</optgroup>
            <optgroup label="Other sheets">{others.map(option)}</optgroup>
          </>
        ) : (
          sheets.map(option)
        )}
      </select>
      <LineIcon name="chevronDown" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
    </div>
  );
}
