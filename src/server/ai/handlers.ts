// What the chat's tools do (§10). Pure: the group's records come in, and proposals are only collected
// and checked, never saved. Read tools look at what the browser draws (`tree`); every proposal is
// dry-run with the real planner against the group's records (`state`), so the model hears at once
// about anything applyOperations would refuse.
import type { ObjectId } from "mongodb";
import { z } from "zod";
import { relationsOf, renameSheetsOps } from "@/tree/edits";
import { buildSheetView } from "@/tree/sheet-view";
import type { GroupTree, Person } from "@/tree/types";
import { OperationError, planOperations, type GroupState } from "../operations/plan";
import { formatDate, lifeDates } from "@/tree/years";
import { day, month, personName, year, type Operation } from "../operations/schema";

export interface ToolContext {
  groupId: ObjectId;
  state: GroupState;
  tree: GroupTree;
  /** The proposal so far: operations collected in this conversation and not yet confirmed. */
  pending: Operation[];
}

export interface ToolOutcome {
  /** For the model: JSON or a sentence. */
  content: string;
  isError: boolean;
  /** The proposal after this call (unchanged for read tools and refusals). */
  pending: Operation[];
  /** For the person: what the assistant is doing, e.g. "Looking up Ravi". */
  activity: string;
}

const SEARCH_LIMIT = 20;
// Years, and a full date's month and day (an owner request), each null when not given.
const dates = { birthYear: year.nullable(), birthMonth: month.nullable(), birthDay: day.nullable(), deathYear: year.nullable(), deathMonth: month.nullable(), deathDay: day.nullable() };
const ref = z.string().regex(/^([a-f\d]{24}|new:\d{1,4})$/i, "not an id");
const inputs = {
  search_people: z.object({ name: z.string().trim().min(1).max(120), year: year.nullable() }),
  get_person: z.object({ personId: ref }),
  add_person: z.object({ name: personName, gender: z.enum(["male", "female"]), ...dates }),
  update_person: z.object({
    personId: ref,
    name: personName.nullable(),
    gender: z.enum(["male", "female"]).nullable(),
    ...dates,
  }),
  add_marriage: z.object({ personId: ref, partnerId: ref, status: z.enum(["married", "divorced"]) }),
  add_child: z.object({ parentIds: z.array(ref).min(1).max(2), childId: ref }),
  create_sheet: z.object({ rootPersonId: ref, title: z.string().trim().min(1).max(120) }),
  add_to_sheet: z.object({ sheetId: ref, personId: ref }),
};
type ToolName = keyof typeof inputs;

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const yearsOf = (p: Person) => ({
  born: p.birthYear ?? null,
  died: p.deathYear ?? null,
  ...(p.birthMonth !== undefined && { birthDate: formatDate(p.birthYear, p.birthMonth, p.birthDay) }),
  ...(p.deathMonth !== undefined && { deathDate: formatDate(p.deathYear, p.deathMonth, p.deathDay) }),
});

/** The next free temporary id in the proposal: new:1, new:2, … */
function nextTempId(pending: Operation[]): string {
  const used = pending.flatMap((op) => ("tempId" in op && op.tempId ? [Number(/^new:(\d+)$/.exec(op.tempId)?.[1] ?? 0)] : []));
  return `new:${Math.max(0, ...used) + 1}`;
}

function search(ctx: ToolContext, { name, year }: z.infer<typeof inputs.search_people>): string {
  const words = fold(name).split(/\s+/).filter(Boolean);
  const matches = ctx.tree.persons.filter(
    (p) => words.every((w) => fold(p.name).includes(w)) && (year === null || p.birthYear === year || p.deathYear === year),
  );
  if (matches.length === 0) return `No one in this family matches "${name}"${year ? ` with the year ${year}` : ""}.`;
  const people = matches.slice(0, SEARCH_LIMIT).map((p) => {
    const { parents, couples } = relationsOf(ctx.tree, p.id);
    return {
      id: p.id,
      name: p.name,
      gender: p.gender,
      ...yearsOf(p),
      parents: parents.map((x) => x.name),
      partners: couples.flatMap((c) => (c.partner ? [c.partner.name] : [])),
    };
  });
  return JSON.stringify({ people, ...(matches.length > SEARCH_LIMIT && { more: matches.length - SEARCH_LIMIT }) });
}

function getPerson(ctx: ToolContext, { personId }: z.infer<typeof inputs.get_person>): ToolOutcome["content"] | null {
  if (personId.startsWith("new:")) return `${personId} is only in the unconfirmed proposal; it has no saved details yet.`;
  const person = ctx.tree.persons.find((p) => p.id === personId.toLowerCase());
  if (!person) return null;
  const { parents, couples } = relationsOf(ctx.tree, person.id);
  const brief = (p: Person) => ({ id: p.id, name: p.name, ...yearsOf(p) });
  return JSON.stringify({
    ...brief(person),
    gender: person.gender,
    parents: parents.map(brief),
    partners: couples.flatMap((c) => (c.partner ? [{ ...brief(c.partner), coupleId: c.union.id, status: c.union.status }] : [])),
    children: couples.flatMap((c) => c.children.map(brief)),
    sheets: ctx.tree.sheets.filter((s) => buildSheetView(ctx.tree, s).persons.some((p) => p.id === person.id)).map((s) => ({ id: s.id, title: s.title })),
  });
}

/** The couple of exactly these partners: saved, or proposed earlier in this conversation. */
function findCouple(ctx: ToolContext, parentIds: string[]): string | undefined {
  const key = (ids: string[]) => ids.map((x) => x.toLowerCase()).sort().join("+");
  const wanted = key(parentIds);
  const saved = ctx.tree.unions.find((u) => key(u.partnerIds) === wanted);
  if (saved) return saved.id;
  const proposed = ctx.pending.find((op) => op.op === "createUnion" && op.tempId && key(op.partnerIds) === wanted);
  return proposed?.op === "createUnion" ? proposed.tempId : undefined;
}

/** The operations a proposal tool stands for, and what to tell the model about them. */
function propose(ctx: ToolContext, name: Exclude<ToolName, "search_people" | "get_person">, input: Record<string, unknown>): { ops: Operation[]; said: string } {
  const temp = nextTempId(ctx.pending);
  switch (name) {
    case "add_person": {
      const { name: person, gender, ...given } = input as z.infer<typeof inputs.add_person>;
      const known = Object.fromEntries(Object.entries(given).map(([key, value]) => [key, value ?? undefined]));
      const op: Operation = { op: "createPerson", tempId: temp, name: person, gender, ...lifeDates(known) };
      return { ops: [op], said: `Added to the proposal: ${person} is ${temp}.` };
    }
    case "update_person": {
      const { personId, ...fields } = input as z.infer<typeof inputs.update_person>;
      const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));
      if (Object.keys(set).length === 0) throw new OperationError("nothing to change", -1);
      const saved = ctx.tree.persons.find((p) => p.id === personId.toLowerCase());
      const sheets = saved && typeof set.name === "string" ? renameSheetsOps(ctx.tree.sheets, saved, set.name) : []; // their sheet's title follows
      return { ops: [{ op: "updatePerson", personId, set }, ...sheets], said: `Added to the proposal: the change to ${personId}.` };
    }
    case "add_marriage": {
      const { personId, partnerId, status } = input as z.infer<typeof inputs.add_marriage>;
      return { ops: [{ op: "createUnion", tempId: temp, partnerIds: [personId, partnerId], status }], said: `Added to the proposal: the couple is ${temp}.` };
    }
    case "add_child": {
      const { parentIds, childId } = input as z.infer<typeof inputs.add_child>;
      const couple = findCouple(ctx, parentIds);
      if (couple) return { ops: [{ op: "addChild", unionId: couple, childId }], said: `Added to the proposal: ${childId} as the child of couple ${couple}.` };
      const partnerIds = parentIds as [string] | [string, string];
      return {
        ops: [
          { op: "createUnion", tempId: temp, partnerIds, status: "married" },
          { op: "addChild", unionId: temp, childId },
        ],
        said: `Added to the proposal: the parents' couple ${temp}, with ${childId} as their child.`,
      };
    }
    case "create_sheet": {
      const { rootPersonId, title } = input as z.infer<typeof inputs.create_sheet>;
      return { ops: [{ op: "createSheet", tempId: temp, title, rootPersonId }], said: `Added to the proposal: the sheet "${title}" is ${temp}.` };
    }
    case "add_to_sheet": {
      const { sheetId, personId } = input as z.infer<typeof inputs.add_to_sheet>;
      return { ops: [{ op: "addToSheet", sheetId, personId }], said: `Added to the proposal: showing ${personId} on sheet ${sheetId}.` };
    }
  }
}

const ACTIVITY: Record<ToolName, (input: Record<string, unknown>) => string> = {
  search_people: (i) => `Looking up ${String(i.name ?? "")}`.trim(),
  get_person: () => "Reading a person's details",
  add_person: (i) => `Proposing ${String(i.name ?? "a new person")}`,
  update_person: () => "Proposing a change",
  add_marriage: () => "Proposing a couple",
  add_child: () => "Proposing a child",
  create_sheet: (i) => `Proposing the sheet ${String(i.title ?? "")}`.trim(),
  add_to_sheet: () => "Proposing a sheet change",
};

/** Runs one tool call. Never throws for bad input: the model gets an error result and can try again. */
export function runTool(name: string, rawInput: unknown, ctx: ToolContext): ToolOutcome {
  const unchanged = (content: string, isError = true): ToolOutcome => ({ content, isError, pending: ctx.pending, activity });
  if (!(name in inputs)) return { content: `There is no tool called ${name}.`, isError: true, pending: ctx.pending, activity: "Thinking" };
  const toolName = name as ToolName;
  const input = (rawInput ?? {}) as Record<string, unknown>;
  const activity = ACTIVITY[toolName](input);
  const parsed = inputs[toolName].safeParse(rawInput);
  if (!parsed.success) {
    const { path, message } = parsed.error.issues[0];
    return unchanged(`Invalid input${path.length ? ` (${path.join(".")})` : ""}: ${message}.`);
  }

  if (toolName === "search_people") return unchanged(search(ctx, parsed.data as z.infer<typeof inputs.search_people>), false);
  if (toolName === "get_person") {
    const details = getPerson(ctx, parsed.data as z.infer<typeof inputs.get_person>);
    return details === null ? unchanged("No one in this family has that id. Use search_people to find their id.") : unchanged(details, false);
  }

  try {
    const { ops, said } = propose(ctx, toolName, parsed.data);
    const pending = [...ctx.pending, ...ops];
    planOperations(ctx.groupId, ctx.state, pending, "assistant", new Date()); // a dry run: throws if it wouldn't apply
    return { content: `${said} Nothing is saved until the user confirms the proposal.`, isError: false, pending, activity };
  } catch (error) {
    if (error instanceof OperationError) return unchanged(`Not added to the proposal: ${error.reason}.`);
    throw error;
  }
}
