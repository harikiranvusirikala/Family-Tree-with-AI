// The app's own file format (F9, F10): lossless, so a group can be exported and imported again.
import { z } from "zod";
import type { GroupTree, NamedSheet } from "@/tree/types";
import { datesProblem } from "@/tree/years";
import { day, month, personName, year } from "../operations/schema";
import { exportPart, MAX_IMPORT_PEOPLE, type ImportData } from "./types";

export const FORMAT = "family-tree-with-ai";

/** The group, or one sheet's part of it, as a JSON file. */
export function exportJson(tree: GroupTree, group: { id: string; name: string }, sheet?: NamedSheet, now = new Date()): string {
  const { persons, unions, sheets } = exportPart(tree, sheet);
  return `${JSON.stringify(
    {
      format: FORMAT,
      version: 1,
      exportedAt: now.toISOString(),
      group,
      persons,
      unions,
      sheets: sheets.map(({ id, title, rootPersonId, extraPersonIds, pinned, order, hideChildrenOf }) => ({
        id,
        title,
        rootPersonId,
        extraPersonIds,
        pinned,
        order,
        ...(hideChildrenOf && { hideChildrenOf }),
      })),
    },
    null,
    2,
  )}\n`;
}

const id = z.string().min(1).max(64);
const fileSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  group: z.object({ id: z.string().max(64), name: z.string().max(120) }),
  persons: z
    .array(
      z.object({
        id,
        name: personName,
        gender: z.enum(["male", "female"]),
        birthYear: year.optional(),
        birthMonth: month.optional(),
        birthDay: day.optional(),
        deathYear: year.optional(),
        deathMonth: month.optional(),
        deathDay: day.optional(),
        photoId: z.string().max(200).optional(),
      }),
    )
    .max(MAX_IMPORT_PEOPLE, `This file has more than ${MAX_IMPORT_PEOPLE} people. Split it into smaller files.`),
  unions: z.array(z.object({ id, partnerIds: z.union([z.tuple([id]), z.tuple([id, id])]), status: z.enum(["married", "divorced"]), childIds: z.array(id) })).max(20_000),
  sheets: z
    .array(z.object({ title: z.string().trim().min(1).max(120), rootPersonId: id, extraPersonIds: z.array(id), pinned: z.boolean(), hideChildrenOf: id.optional() }))
    .max(500),
});

/** A file exported by this app, or the reason it can't be imported. */
export function parseJson(text: string): ImportData | string {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return "This isn't a JSON file.";
  }
  if ((json as { format?: unknown })?.format !== FORMAT) return "This JSON file wasn't exported from Family Tree with AI. Import a GEDCOM file instead.";
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return issue.code === "too_big" && issue.path[0] === "persons" ? issue.message : "This file is damaged or from a newer version of the app.";
  }
  const { group, persons, unions, sheets } = parsed.data;
  const known = new Set(persons.map((p) => p.id));
  const missing = [...unions.flatMap((u) => [...u.partnerIds, ...u.childIds]), ...sheets.flatMap((s) => [s.rootPersonId, ...s.extraPersonIds])].some((p) => !known.has(p));
  if (missing) return "This file is damaged: it refers to people it doesn't contain.";
  const badDates = persons.find((p) => datesProblem(p));
  if (badDates) return `This file is damaged: ${badDates.name}'s dates don't make sense.`;
  const couples = new Set(unions.map((u) => u.id));
  if (sheets.some((s) => s.hideChildrenOf !== undefined && !couples.has(s.hideChildrenOf))) return "This file is damaged: it refers to couples it doesn't contain.";
  return { kind: "json", persons, unions, sheets, sourceGroupId: group.id, suggestedName: group.name, warnings: [], notKept: [] };
}
