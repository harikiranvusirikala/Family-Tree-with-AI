"use client";

import { useEffect, useRef, useState } from "react";

/**
 * F9: Export, at the end of the sheet tabs. Everyone can save the sheet as a picture or print it
 * (and so save a PDF); Maintain and up also download the data, of this sheet or the whole group.
 * Without `sheetId` (★ Everyone) there's no "this sheet" data: the whole group's is the same.
 */
export function ExportMenu({
  groupId,
  sheetId,
  canExportData,
  busy,
  onPicture,
  onPrint,
}: {
  groupId: string;
  sheetId?: string;
  canExportData: boolean;
  busy: boolean;
  onPicture: () => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen(!open)}
        className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {busy ? "Preparing…" : "Export"}
      </button>
      {open && (
        <div role="menu" aria-label="Export" className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-900 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          <ExportItems
            groupId={groupId}
            sheetId={sheetId}
            canExportData={canExportData}
            onPicture={onPicture}
            onPrint={onPrint}
            onDone={() => setOpen(false)}
            itemClass="block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
          />
        </div>
      )}
    </div>
  );
}

/**
 * The Export menu's items, also in the sheet menu below 1024 px (phones and tablets). `headings`:
 * "This sheet" (or "Everyone", without `sheetId`) and "The whole group" above their items; `onDone`
 * runs after any item is chosen.
 */
export function ExportItems({
  groupId,
  sheetId,
  canExportData,
  onPicture,
  onPrint,
  onDone = () => {},
  itemClass,
  headings = true,
}: {
  groupId: string;
  sheetId?: string;
  canExportData: boolean;
  onPicture: () => void;
  onPrint: () => void;
  onDone?: () => void;
  itemClass: string;
  headings?: boolean;
}) {
  const data = (format: "json" | "gedcom", sheet: boolean) => `/api/groups/${groupId}/export?format=${format}${sheet ? `&sheet=${sheetId}` : ""}`;
  return (
    <>
      {headings && <p className="px-3 pt-1 text-xs text-zinc-500 dark:text-zinc-400">{sheetId ? "This sheet" : "Everyone"}</p>}
      <button type="button" role="menuitem" className={itemClass} onClick={() => (onDone(), onPicture())}>
        Picture (PNG)
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => (onDone(), onPrint())}>
        Print or save as PDF
      </button>
      {canExportData && (
        <>
          {sheetId && (
            <>
              <a role="menuitem" className={itemClass} href={data("gedcom", true)} download onClick={onDone}>
                Data: this sheet (GEDCOM)
              </a>
              <a role="menuitem" className={itemClass} href={data("json", true)} download onClick={onDone}>
                Data: this sheet (JSON)
              </a>
            </>
          )}
          {headings && <p className="px-3 pt-2 text-xs text-zinc-500 dark:text-zinc-400">The whole group</p>}
          <a role="menuitem" className={itemClass} href={data("gedcom", false)} download onClick={onDone}>
            Data: whole group (GEDCOM)
          </a>
          <a role="menuitem" className={itemClass} href={data("json", false)} download onClick={onDone}>
            Data: whole group (JSON)
          </a>
        </>
      )}
    </>
  );
}
