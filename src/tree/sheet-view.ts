import type { FamilyData, Sheet, SheetView, Union } from "./types";

/**
 * Who belongs on a sheet (ARCHITECTURE.md §6). A sheet stores only a root and extras;
 * everything else is computed here, so a person added once shows on every sheet that reaches them.
 *
 * 1. Ancestors: walk up from the root through both parents.
 * 2. Blood relatives: all descendants of the root and of every ancestor.
 * 3. Partners of everyone found so far, including ex-partners. Partners' parents are not followed.
 * 4. Extras ("show X in this sheet").
 */
export function buildSheetView(data: FamilyData, sheet: Sheet): SheetView {
  const knownIds = new Set(data.persons.map((p) => p.id));
  if (!knownIds.has(sheet.rootPersonId)) {
    return { rootPersonId: sheet.rootPersonId, persons: [], unions: [] };
  }

  const parentUnionOf = new Map<string, Union>();
  const unionsOf = new Map<string, Union[]>();
  for (const u of data.unions) {
    for (const c of u.childIds) parentUnionOf.set(c, u);
    for (const p of u.partnerIds) unionsOf.set(p, [...(unionsOf.get(p) ?? []), u]);
  }

  // 1. Ancestors
  const ancestors = new Set<string>();
  const up = [sheet.rootPersonId];
  while (up.length) {
    const parents = parentUnionOf.get(up.pop()!)?.partnerIds ?? [];
    for (const p of parents) {
      if (!ancestors.has(p)) {
        ancestors.add(p);
        up.push(p);
      }
    }
  }

  // 2. Blood relatives
  const blood = new Set([sheet.rootPersonId, ...ancestors]);
  const down = [...blood];
  while (down.length) {
    for (const u of unionsOf.get(down.pop()!) ?? []) {
      for (const c of u.childIds) {
        if (!blood.has(c)) {
          blood.add(c);
          down.push(c);
        }
      }
    }
  }

  // 3. Partners
  const onSheet = new Set(blood);
  for (const id of blood) {
    for (const u of unionsOf.get(id) ?? []) u.partnerIds.forEach((p) => onSheet.add(p));
  }

  // 4. Extras
  for (const id of sheet.extraPersonIds) if (knownIds.has(id)) onSheet.add(id);

  return {
    rootPersonId: sheet.rootPersonId,
    persons: data.persons.filter((p) => onSheet.has(p.id)),
    unions: data.unions
      .filter((u) => u.partnerIds.every((p) => onSheet.has(p)))
      .map((u) => ({ ...u, childIds: u.childIds.filter((c) => onSheet.has(c)) })),
  };
}
