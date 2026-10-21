// A proposal in plain words, for the chat's proposal card (F7). Pure: it runs in the browser.
import type { Operation } from "@/server/operations/schema";
import type { GroupTree, Person } from "./types";
import { formatDate, formatLife, formatYears } from "./years";

/** One line per change, e.g. "Add Priya Sharma (female)" or "Priya Sharma and Ravi Kumar (1980) are married". */
export function describeOperations(ops: Operation[], tree: GroupTree): string[] {
  const people = new Map(
    tree.persons.map((p) => {
      const years = formatYears(p.birthYear, p.deathYear);
      return [p.id, years ? `${p.name} (${years})` : p.name] as const;
    }),
  );
  const couples = new Map(tree.unions.map((u) => [u.id, u.partnerIds as string[]] as const));
  const byId = new Map<string, Person>(tree.persons.map((p) => [p.id, p]));
  const sheets = new Map(tree.sheets.map((s) => [s.id, s.title] as const));
  for (const op of ops) {
    if (op.op === "createPerson") people.set(op.tempId, op.name);
    if (op.op === "createUnion" && op.tempId) couples.set(op.tempId, op.partnerIds);
    if (op.op === "createSheet" && op.tempId) sheets.set(op.tempId, op.title);
  }
  const who = (id: string) => people.get(id.toLowerCase()) ?? people.get(id) ?? "someone not in this family";
  const both = (ids: string[]) => ids.map(who).join(" and ");

  return ops.map((op) => {
    switch (op.op) {
      case "createPerson": {
        const years = formatLife(op);
        return `Add ${op.name} (${op.gender}${years ? `, ${years}` : ""})`;
      }
      case "updatePerson": {
        const saved = byId.get(op.personId.toLowerCase());
        /** A change to the birth's (or death's) year, day or month, as it will be after the change. */
        const dateChange = (what: "birth" | "death") => {
          const [y, m, d] = (["Year", "Month", "Day"] as const).map((part) => `${what}${part}` as const);
          if ([y, m, d].every((key) => op.set[key] === undefined)) return false;
          const after = (key: typeof y | typeof m | typeof d) => (op.set[key] === undefined ? saved?.[key] : (op.set[key] ?? undefined));
          if (after(y) === undefined) return `remove the ${what} year`;
          if (op.set[m] === undefined && op.set[d] === undefined) return `${what} year to ${after(y)}`;
          if (after(m) === undefined) return `remove the ${what} day and month`;
          return `${what} date to ${formatDate(after(y), after(m), after(d))}`;
        };
        const changes = [
          op.set.name !== undefined && `name to ${op.set.name}`,
          op.set.gender !== undefined && `gender to ${op.set.gender}`,
          dateChange("birth"),
          dateChange("death"),
        ].filter(Boolean);
        return `Change ${who(op.personId)}: ${changes.join(", ")}`;
      }
      case "createUnion":
        return op.partnerIds.length === 2 ? `${both(op.partnerIds)} ${op.status === "divorced" ? "were married and are divorced" : "are married"}` : `${who(op.partnerIds[0])} as a single parent`;
      case "updateUnion":
        return `Mark ${both(couples.get(op.unionId) ?? [])} as ${op.status}`;
      case "addChild":
        return `${who(op.childId)} is the child of ${both(couples.get(op.unionId) ?? [])}`;
      case "addPartner":
        return `${who(op.personId)} joins ${both(couples.get(op.unionId) ?? [])} as a parent`;
      case "createSheet":
        return `New sheet "${op.title}" about ${who(op.rootPersonId)}`;
      case "addToSheet":
        return `Show ${who(op.personId)} on the sheet "${sheets.get(op.sheetId) ?? "?"}"`;
      case "updateSheet":
        return op.set.title !== undefined && op.set.pinned === undefined
          ? `Rename the sheet "${sheets.get(op.sheetId) ?? "?"}" to "${op.set.title}"`
          : `Change the sheet "${sheets.get(op.sheetId) ?? "?"}"`;
      case "deleteSheet":
        return `Delete the sheet "${sheets.get(op.sheetId) ?? "?"}"`;
      case "setPhoto":
        return `${op.photoId ? "Change" : "Remove"} the photo of ${who(op.personId)}`;
      case "deletePerson":
        return `Delete ${who(op.personId)}`;
      case "restorePerson":
        return `Bring back ${who(op.personId)}`;
      case "reorderSheets":
        return "Reorder the sheet tabs";
    }
  });
}
