import type { FamilyData } from "@/tree/types";
import { lifeDates } from "@/tree/years";
import type { Operation } from "./schema";

export interface SheetSpec {
  title: string;
  rootPersonId: string;
  extraPersonIds?: string[];
  pinned?: boolean;
}

/**
 * Turns family data with its own ids into operations that recreate it, using temporary ids
 * ("new:<original id>"). Used by the seed script, and by imports (step 10).
 */
export function operationsFromFamily(data: FamilyData, sheets: SheetSpec[] = []): Operation[] {
  const t = (id: string) => `new:${id.replace(/[^\w-]/g, "_")}`;
  return [
    ...data.persons.map(
      (p): Operation => ({
        op: "createPerson",
        tempId: t(p.id),
        name: p.name,
        gender: p.gender,
        ...lifeDates(p),
      }),
    ),
    ...data.unions.flatMap((u): Operation[] => [
      { op: "createUnion", tempId: t(u.id), partnerIds: u.partnerIds.map(t) as [string] | [string, string], status: u.status },
      ...u.childIds.map((c): Operation => ({ op: "addChild", unionId: t(u.id), childId: t(c) })),
    ]),
    ...sheets.flatMap((s, i): Operation[] => [
      { op: "createSheet", tempId: `new:sheet-${i}`, title: s.title, rootPersonId: t(s.rootPersonId), pinned: s.pinned ?? false },
      ...(s.extraPersonIds ?? []).map((p): Operation => ({ op: "addToSheet", sheetId: `new:sheet-${i}`, personId: t(p) })),
    ]),
  ];
}
