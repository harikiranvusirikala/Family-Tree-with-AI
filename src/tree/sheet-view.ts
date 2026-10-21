import type { FamilyData, Sheet, SheetView, Union } from "./types";

/** A group's people and couples, with its sheets when known: they decide where step 1 stops. */
type SheetData = FamilyData & { sheets?: readonly Sheet[] };

/**
 * Who belongs on a sheet (ARCHITECTURE.md §6). A sheet stores only a root and extras;
 * everything else is computed here, so a person added once shows on every sheet that reaches them.
 *
 * 1. Ancestors: walk up from the root through both parents, but not above a parent whose side of the
 *    family is on their own sheet: a sheet rooted at them that leaves out the children of the couple
 *    the walk came through (a mother's own sheet). They show; their parents and cousins don't.
 * 2. Blood relatives: all descendants of the root and of every ancestor, except the children of the
 *    couple the sheet hides (`hideChildrenOf`) and their families.
 * 3. Partners of everyone found so far, including ex-partners. Partners' parents are not followed.
 * 4. Extras ("show X in this sheet").
 */
export function buildSheetView(data: SheetData, sheet: Sheet): SheetView {
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
  // "person couple": someone's own sheet that leaves out that couple's children.
  const ownSide = new Set((data.sheets ?? []).flatMap((s) => (s.hideChildrenOf ? [`${s.rootPersonId} ${s.hideChildrenOf}`] : [])));

  // 1. Ancestors. Someone reached through two couples (cousins who married) is still walked above
  // when only one of them is left out of their own sheet.
  const ancestors = new Set<string>();
  const climbed = new Set<string>();
  const up = [sheet.rootPersonId];
  while (up.length) {
    const couple = parentUnionOf.get(up.pop()!);
    for (const p of couple?.partnerIds ?? []) {
      ancestors.add(p);
      if (!climbed.has(p) && !ownSide.has(`${p} ${couple!.id}`)) {
        climbed.add(p);
        up.push(p);
      }
    }
  }

  // 2. Blood relatives
  const blood = new Set([sheet.rootPersonId, ...ancestors]);
  const down = [...blood];
  while (down.length) {
    for (const u of unionsOf.get(down.pop()!) ?? []) {
      if (u.id === sheet.hideChildrenOf) continue;
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

/**
 * Whether parents added to this person would be drawn on the sheet. Not for a partner who married in
 * (step 3), nor above someone whose side of the family is on their own sheet (step 1). Worked out by
 * drawing the sheet with a stand-in parent, so it follows the rules above exactly.
 */
export function showsNewParentsOf(data: SheetData, sheet: Sheet, personId: string): boolean {
  const probe = "new:parent";
  const couple = data.unions.find((u) => u.childIds.includes(personId));
  const unions: Union[] = couple
    ? data.unions.map((u) => (u === couple ? { ...u, partnerIds: [u.partnerIds[0], probe] } : u))
    : [...data.unions, { id: "new:parents", partnerIds: [probe], status: "married", childIds: [personId] }];
  const persons = [...data.persons, { id: probe, name: "", gender: "male" as const }];
  return buildSheetView({ ...data, persons, unions }, sheet).persons.some((p) => p.id === probe);
}
