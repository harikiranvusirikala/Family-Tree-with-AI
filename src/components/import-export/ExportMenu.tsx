"use client";

import { button } from "@/components/ui/button";
import { LineIcon } from "@/components/ui/icons";
import { Menu, MenuLabel, menuItem } from "@/components/ui/Menu";

/**
 * F9: Export, at the end of the sheet tabs. Everyone can save the sheet as a picture or print it
 * (and so save a PDF); Maintain and up also download the data, of this sheet or the whole group.
 * Without `sheetId` (★ Everyone) there's no "this sheet" data: the whole group's is the same. Without
 * `onPicture` and `onPrint` (★ Everyone's List, which draws no tree) there's no picture either.
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
  onPicture?: () => void;
  onPrint?: () => void;
}) {
  return (
    <Menu
      label="Export"
      disabled={busy}
      menuClassName="w-64"
      buttonClassName={button("secondary")}
      button={
        <>
          <LineIcon name="download" className="size-4" />
          {busy ? "Preparing…" : "Export"}
        </>
      }
    >
      {(close) => <ExportItems groupId={groupId} sheetId={sheetId} canExportData={canExportData} onPicture={onPicture} onPrint={onPrint} onDone={close} itemClass={menuItem} />}
    </Menu>
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
  onPicture?: () => void;
  onPrint?: () => void;
  onDone?: () => void;
  itemClass: string;
  headings?: boolean;
}) {
  const data = (format: "json" | "gedcom", sheet: boolean) => `/api/groups/${groupId}/export?format=${format}${sheet ? `&sheet=${sheetId}` : ""}`;
  return (
    <>
      {headings && (onPicture || (canExportData && sheetId)) && <MenuLabel>{sheetId ? "This sheet" : "Everyone"}</MenuLabel>}
      {onPicture && (
        <button type="button" role="menuitem" className={itemClass} onClick={() => (onDone(), onPicture())}>
          Picture (PNG)
        </button>
      )}
      {onPrint && (
        <button type="button" role="menuitem" className={itemClass} onClick={() => (onDone(), onPrint())}>
          Print or save as PDF
        </button>
      )}
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
          {headings && <MenuLabel>The whole group</MenuLabel>}
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
