// What an imported file becomes before it turns into operations (F10). Pure, so the browser parses
// files and shows the preview, and the server re-checks the operations on the single write path.
import { buildSheetView } from "@/tree/sheet-view";
import type { Gender, GroupTree, NamedSheet, Person, Union } from "@/tree/types";

/** People per imported file (decided in step 10): one import stays one quick transaction. */
export const MAX_IMPORT_PEOPLE = 2000;

/** As in the file; `gender` is null when the file doesn't say (GEDCOM's `SEX U` or none). */
export interface ImportPerson {
  id: string;
  name: string;
  gender: Gender | null;
  birthYear?: number;
  deathYear?: number;
  photoId?: string;
}

export interface ImportSheet {
  title: string;
  rootPersonId: string;
  extraPersonIds: string[];
  pinned: boolean;
  /** The file's id of a couple whose children the sheet leaves out (Sheet.hideChildrenOf). */
  hideChildrenOf?: string;
}

export interface ImportData {
  kind: "json" | "gedcom";
  persons: ImportPerson[];
  unions: Union[];
  /** JSON files carry their sheets; GEDCOM has none. */
  sheets: ImportSheet[];
  /** The group a JSON file was exported from: its photos only fit there. */
  sourceGroupId?: string;
  /** A name for a new group: the exported group's, or the file's. */
  suggestedName?: string;
  /** Things changed to fit the app, one sentence each. */
  warnings: string[];
  /** What the file had that the app doesn't keep. */
  notKept: string[];
}

/** What a data export contains: the whole group, or exactly what one sheet shows (§6). */
export function exportPart(tree: GroupTree, sheet?: NamedSheet): { persons: Person[]; unions: Union[]; sheets: NamedSheet[] } {
  if (!sheet) return tree;
  const view = buildSheetView(tree, sheet);
  const shown = new Set(view.persons.map((p) => p.id));
  return { persons: view.persons, unions: view.unions, sheets: [{ ...sheet, extraPersonIds: sheet.extraPersonIds.filter((id) => shown.has(id)) }] };
}

/** A file name without characters that file systems refuse. */
export const fileName = (...parts: string[]) => parts.join(" - ").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "family";
