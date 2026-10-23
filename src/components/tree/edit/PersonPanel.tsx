"use client";

import { useId, useState, type FormEvent } from "react";
import type { Operation } from "@/server/operations/schema";
import { addChildOps, addParentsOps, addPartnerOps, editPersonOps, newSheetOps, relationsOf, showOnSheetOps, tabOrder, type NewParent } from "@/tree/edits";
import { EVERYONE } from "@/tree/everyone";
import { buildSheetView, showsNewParentsOf } from "@/tree/sheet-view";
import type { Gender, GroupTree, Person, Union } from "@/tree/types";
import { ageText } from "@/tree/upcoming";
import { eldestFirst, formatLife, formatMarriage, formatYears } from "@/tree/years";
import { useToday } from "../../today";
import { button, iconButton } from "../../ui/button";
import { choice, choiceLabel, field, fieldLabel, formError as formErrorClass } from "../../ui/field";
import { LineIcon, type IconName } from "../../ui/icons";
import { PersonPhoto } from "../PersonPhoto";
import { detailsPanel, panelBody, panelFooter, panelHeader, panelHeading, panelNote } from "./panel";
import { PersonFields, readPerson, SubmitRow } from "./person-form";
import { PhotoControls, type SignPhotoUpload } from "./PhotoControls";

type Mode = "details" | "edit" | "parents" | "partner" | "child" | "sheet" | "ownSheet";

/** In ★ Everyone's Wheel: how this person is related to the one in the middle. */
export interface WheelRelation {
  /** "Babai · Uncle"; null for the person in the middle. */
  names: string | null;
  /** "Steve Cruz's father's younger brother". */
  path: string;
  /** Puts them in the middle; not given for the person already there. */
  onMiddle?: () => void;
}

export interface PanelProps {
  tree: GroupTree;
  canEdit: boolean;
  pending: boolean;
  /** Sends a batch to the server; resolves to the new ids, or null after an error (shown by the page). */
  run: (ops: Operation[]) => Promise<Record<string, string> | null>;
  onSelect: (personId: string) => void;
  onClose: () => void;
}

const opposite = (g: Person["gender"]) => (g === "male" ? "female" : "male");
/** "Timothy Cruz (1940 – 2020)": tells apart people with the same name in lists. */
export const nameWithYears = (p: Person) => `${p.name}${formatYears(p.birthYear, p.deathYear) ? ` (${formatYears(p.birthYear, p.deathYear)})` : ""}`;

/** A line in the panel that does something: Go to a sheet, Add parents (the production look). */
const rowButton =
  "flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm font-medium text-zinc-800 transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/70 disabled:opacity-60 pointer-coarse:min-h-11 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800/60";
/** ★ Everyone's views around the person, as tiles. */
const tile =
  "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-2 py-3 text-xs font-medium text-zinc-700 transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60";
/** Under a partner's name: "Married 8 Sep 2008", "Married 2001 · divorced", "Divorced". */
function coupleLine(union: Union) {
  const date = formatMarriage(union);
  if (union.status === "divorced") return date ? `Married ${date} · divorced` : "Divorced";
  return date ? `Married ${date}` : "Married";
}

/** A small heading over a form's group of fields. */
const formHeading = "text-base font-semibold tracking-tight";

/**
 * A parent, partner or child: their photo, name and years (and a partner's marriage), selecting them.
 * Named like their card ("Jerry Willow, 1920 – 1989"), the marriage as its description.
 */
export function Relative({ p, detail, onSelect }: { p: Person; detail?: string; onSelect: (personId: string) => void }) {
  const years = formatYears(p.birthYear, p.deathYear);
  const detailId = useId();
  return (
    <li>
      <button
        type="button"
        aria-label={years ? `${p.name}, ${years}` : p.name}
        aria-describedby={detail ? detailId : undefined}
        onClick={() => onSelect(p.id)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500/70 pointer-coarse:min-h-11 dark:hover:bg-zinc-800"
      >
        <PersonPhoto person={p} size={32} thin />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{p.name}</span>
          {detail && (
            <span id={detailId} className="block text-xs text-zinc-500 dark:text-zinc-400">
              {detail}
            </span>
          )}
        </span>
        {years && <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{years}</span>}
      </button>
    </li>
  );
}

/**
 * "Create their own sheet": a tab rooted at the new person. Checked for a partner, who usually married
 * in, and for a mother (owner requests after step 11 and after the full dates), whose sheet leaves out
 * her children with the father and holds her side of the family.
 */
function OwnSheetBox({ name, checked = false, hint }: { name: string; checked?: boolean; hint: string }) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <input type="checkbox" name={name} defaultChecked={checked} className={`${choice} mt-0.5`} />
      <span>
        <span className="font-medium">Create their own sheet</span>
        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
      </span>
    </label>
  );
}

const MOTHER_SHEET_HINT = "a tab for her side of the family. Her parents, brothers and sisters show there, not on her children's sheets.";

/**
 * F6: one person's details and, for Maintain and up, what can be done with them. `signPhotoUpload` is
 * given when they may change photos and photos are set up (F8). Everyone can go to the person's own
 * sheets (an owner request after step 11): `onOpenSheet` opens one, as its tab would. On ★ Everyone
 * (`currentSheetId` EVERYONE) it also offers a sheet that shows them. `onFindInList`, `onShowInNetwork`
 * and `onShowWheel`, given everywhere but in that view itself, open ★ Everyone's List at their row, its
 * Network centred on them, or its Wheel around them. In the Wheel, `relation` says how they're related
 * to the person in the middle.
 */
export function PersonPanel({
  person,
  onDelete,
  signPhotoUpload,
  currentSheetId,
  onOpenSheet,
  onFindInList,
  onShowInNetwork,
  onShowWheel,
  relation,
  ...props
}: PanelProps & {
  person: Person;
  onDelete: (person: Person) => void;
  signPhotoUpload?: SignPhotoUpload;
  currentSheetId: string;
  onOpenSheet: (sheetId: string) => void;
  onFindInList?: () => void;
  onShowInNetwork?: () => void;
  onShowWheel?: () => void;
  relation?: WheelRelation;
}) {
  const { tree, canEdit, pending, run, onSelect, onClose } = props;
  const [mode, setMode] = useState<Mode>("details");
  const [formError, setFormError] = useState<string | null>(null);
  const { parents, couples } = relationsOf(tree, person.id);
  // The other parent's gender as chosen in the form: a mother gets the "own sheet" option.
  const [otherGender, setOtherGender] = useState<Gender | null>(null);
  const otherIsMother = parents.length === 1 && (otherGender ?? opposite(parents[0].gender)) === "female";
  const dates = formatLife(person); // full dates where known (an owner request)
  const today = useToday();
  const age = today ? ageText(person, today) : ""; // on the device's day (birthdays and anniversaries, an owner request)

  /** Reads a form, builds its operations, and goes back to the details once saved (then `onSaved`). */
  const submit = (build: (form: FormData) => Operation[] | string, onSaved?: () => void) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const built = build(new FormData(event.currentTarget));
    if (typeof built === "string") return setFormError(built);
    setFormError(null);
    if (built.length === 0) return setMode("details");
    if (await run(built)) {
      setMode("details");
      onSaved?.();
    }
  };
  const back = () => {
    setFormError(null);
    setMode("details");
  };

  const otherSheets = tree.sheets.filter((s) => !buildSheetView(tree, s).persons.some((p) => p.id === person.id));
  // Sheets rooted at them (someone who married in, a mother's own), apart from the one open.
  const ownSheets = tabOrder(tree.sheets).filter((s) => s.rootPersonId === person.id && s.id !== currentSheetId);
  // On ★ Everyone: the first sheet, in tab order, that shows them (unless it's one of their own, above).
  const showOn =
    currentSheetId === EVERYONE ? tabOrder(tree.sheets).find((s) => buildSheetView(tree, s).persons.some((p) => p.id === person.id)) : undefined;
  const jumps = [
    ...ownSheets.map((s) => ({ id: s.id, label: `Go to ${s.title}` })),
    // "Go to" too: "Show on another sheet", below, is the edit that adds someone to a sheet.
    ...(showOn && !ownSheets.includes(showOn) ? [{ id: showOn.id, label: `Go to ${showOn.title}` }] : []),
  ];
  // ★ Everyone's views, given everywhere but in that view itself; their names say what they do.
  const views = (
    [
      onShowWheel && { name: "Relatives wheel", label: "Wheel", icon: "target", onClick: onShowWheel },
      onShowInNetwork && { name: "Show in network", label: "Network", icon: "network", onClick: onShowInNetwork },
      onFindInList && { name: "Find in list", label: "List", icon: "list", onClick: onFindInList },
    ] as const
  ).filter((v): v is { name: string; label: string; icon: IconName; onClick: () => void } => !!v);
  const partnerCount = couples.filter((c) => c.partner).length;
  // Create their own sheet (an owner request after the final check): for someone without one. A woman's
  // starts by leaving out her children with her (first) partner, like a mother's sheet from Add
  // parents; a man's shows all his children, like a partner who married in.
  const hasOwnSheet = tree.sheets.some((s) => s.rootPersonId === person.id);
  const withChildren = couples.filter((c) => c.children.length > 0);
  const their = person.gender === "female" ? "her" : "his";
  // Parents added from a sheet that won't show them (above a mother whose side is on her own sheet, or
  // a partner who married in) go on the person's own sheet, which opens once they're saved (an owner
  // request after the full dates).
  const currentSheet = tree.sheets.find((s) => s.id === currentSheetId);
  const parentsOn =
    mode === "parents" && currentSheet && !showsNewParentsOf(tree, currentSheet, person.id)
      ? tabOrder(tree.sheets).find((s) => s.rootPersonId === person.id)
      : undefined;

  return (
    <aside aria-label="Person details" className={detailsPanel(mode !== "details")}>
      {mode === "details" && <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 md:hidden dark:bg-zinc-700" />}
      <div className={panelHeader}>
        <PersonPhoto person={person} size={64} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <h2 className="text-lg leading-snug font-semibold tracking-tight">{person.name}</h2>
          {dates && <p className="text-sm text-zinc-500 dark:text-zinc-400">{dates}</p>}
          {age && <p className="text-sm text-zinc-500 dark:text-zinc-400">{age}</p>}
          {mode === "details" && canEdit && signPhotoUpload && (
            <div className="mt-1.5">
              <PhotoControls person={person} signUpload={signPhotoUpload} pending={pending} run={run} onError={setFormError} />
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className={`${iconButton} -mt-1 -mr-2`}>
          <LineIcon name="x" className="size-5" />
        </button>
      </div>

      {mode === "details" && (
        <>
          <div className={panelBody}>
            {relation && (
              <div
                aria-label="Relation"
                role="group"
                className="flex flex-col items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm dark:border-amber-900/60 dark:bg-amber-950/30"
              >
                {relation.names ? (
                  <>
                    <p className="font-semibold">{relation.names}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">{relation.path}</p>
                  </>
                ) : (
                  <p className="font-semibold">In the middle of the wheel</p>
                )}
                {relation.onMiddle && (
                  <button type="button" onClick={relation.onMiddle} className={button("primary", "sm")}>
                    <LineIcon name="target" className="size-4" />
                    Put in the middle
                  </button>
                )}
              </div>
            )}

            {(jumps.length > 0 || views.length > 0) && (
              <div className="flex flex-col gap-2">
                {jumps.map((jump) => (
                  <button key={jump.id} type="button" onClick={() => onOpenSheet(jump.id)} className={rowButton}>
                    <LineIcon name="sheets" className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    <span className="min-w-0 flex-1 truncate">{jump.label}</span>
                    <LineIcon name="arrowRight" className="size-4 shrink-0 text-zinc-400" />
                  </button>
                ))}
                {views.length > 0 && (
                  // ★ Everyone's views, around this person.
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2">
                    {views.map((v) => (
                      <button key={v.name} type="button" aria-label={v.name} onClick={v.onClick} className={tile}>
                        <LineIcon name={v.icon} className="size-5" />
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <section>
                <h3 className={panelHeading}>Parents</h3>
                {parents.length ? (
                  <ul>
                    {parents.map((p) => (
                      <Relative key={p.id} p={p} onSelect={onSelect} />
                    ))}
                  </ul>
                ) : (
                  <p className={panelNote}>Not added</p>
                )}
              </section>
              <section>
                <h3 className={panelHeading}>{partnerCount === 1 ? "Partner" : "Partners"}</h3>
                {partnerCount ? (
                  <ul>
                    {couples.flatMap((c) =>
                      c.partner ? [<Relative key={c.union.id} p={c.partner} onSelect={onSelect} detail={coupleLine(c.union)} />] : [],
                    )}
                  </ul>
                ) : (
                  <p className={panelNote}>None</p>
                )}
              </section>
              <section>
                <h3 className={panelHeading}>Children</h3>
                {couples.some((c) => c.children.length) ? (
                  <ul>
                    {eldestFirst(couples.flatMap((c) => c.children)).map((p) => (
                      <Relative key={p.id} p={p} onSelect={onSelect} />
                    ))}
                  </ul>
                ) : (
                  <p className={panelNote}>None</p>
                )}
              </section>
            </div>

            {canEdit && (
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setMode("edit")} disabled={pending} className={button("primary")}>
                  <LineIcon name="pencil" className="size-4" />
                  Edit details
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMode("partner")} disabled={pending} className={button("secondary")}>
                    <LineIcon name="heart" className="size-4" />
                    Add partner
                  </button>
                  <button type="button" onClick={() => setMode("child")} disabled={pending} className={button("secondary")}>
                    <LineIcon name="plus" className="size-4" />
                    Add child
                  </button>
                </div>
                {(
                  [
                    ["parents", parents.length === 1 ? "Add the other parent" : "Add parents", parents.length < 2, "people"],
                    ["sheet", "Show on another sheet", otherSheets.length > 0, "sheets"],
                    ["ownSheet", "Create their own sheet", !hasOwnSheet, "tree"],
                  ] as const
                ).map(([m, label, shown, iconName]) =>
                  shown ? (
                    <button key={m} type="button" onClick={() => setMode(m)} disabled={pending} className={rowButton}>
                      <LineIcon name={iconName} className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                      {label}
                    </button>
                  ) : null,
                )}
              </div>
            )}
            <Problem error={formError} />
          </div>
          {canEdit && (
            <div className={panelFooter}>
              <button type="button" onClick={() => onDelete(person)} disabled={pending} className={button("dangerGhost")}>
                <LineIcon name="trash" className="size-4" />
                Delete {person.name}
              </button>
            </div>
          )}
        </>
      )}

      {mode !== "details" && (
        <div className={panelBody}>
          {mode === "edit" && (
            <form aria-label="Edit details" onSubmit={submit((form) => {
              const read = readPerson(form);
              return typeof read === "string" ? read : editPersonOps(person, read, tree.sheets);
            })} className="flex flex-col gap-4">
              <h3 className={formHeading}>Edit details</h3>
              <PersonFields defaults={person} />
              <SubmitRow label="Save" pending={pending} onCancel={back} />
            </form>
          )}

          {mode === "parents" && (
            <form aria-label="Add parents" onChange={({ target }) => {
              if (target instanceof HTMLInputElement && target.name === "other-gender") setOtherGender(target.value as Gender);
            }} onSubmit={submit((form) => {
              const ownSheet = (prefix: string) => form.get(`${prefix}ownSheet`) === "on";
              if (parents.length === 1) {
                const read = readPerson(form, "other-");
                return typeof read === "string" ? read : addParentsOps(tree, person.id, [{ ...read, ownSheet: read.gender === "female" && ownSheet("other-") }]);
              }
              const entered: NewParent[] = [];
              for (const [prefix, who] of [["father-", "Father"], ["mother-", "Mother"]] as const) {
                if (String(form.get(`${prefix}name`) ?? "").trim() === "") continue; // either may be left out, and then has no sheet
                const read = readPerson(form, prefix, who);
                if (typeof read === "string") return read;
                entered.push({ ...read, ownSheet: ownSheet(prefix) });
              }
              return entered.length ? addParentsOps(tree, person.id, entered) : "Enter at least one parent's name.";
            }, parentsOn && (() => onOpenSheet(parentsOn.id)))} className="flex flex-col gap-4">
              {parents.length === 1 ? (
                <>
                  <h3 className={formHeading}>The other parent of {person.name}</h3>
                  <PersonFields prefix="other-" defaults={{ gender: opposite(parents[0].gender) }} />
                  {otherIsMother && <OwnSheetBox name="other-ownSheet" checked hint={`For the mother: ${MOTHER_SHEET_HINT}`} />}
                </>
              ) : (
                <>
                  <h3 className={formHeading}>Parents of {person.name}</h3>
                  <PersonFields prefix="father-" who="Father" fixedGender="male" />
                  <PersonFields prefix="mother-" who="Mother" fixedGender="female" />
                  <OwnSheetBox name="mother-ownSheet" checked hint={`For the mother: ${MOTHER_SHEET_HINT}`} />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Leave one out if you don&apos;t know them yet.</p>
                </>
              )}
              {parentsOn && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
                  They&apos;ll be on {parentsOn.title}, not on this sheet. Saving opens it.
                </p>
              )}
              <SubmitRow label={parents.length === 1 ? "Add parent" : "Add parents"} pending={pending} onCancel={back} />
            </form>
          )}

          {mode === "partner" && (
            <form aria-label="Add partner" onSubmit={submit((form) => {
              const read = readPerson(form);
              if (typeof read === "string") return read;
              const status = form.get("status") === "divorced" ? "divorced" : "married";
              return addPartnerOps(person.id, read, { status, ownSheet: form.get("ownSheet") === "on" });
            })} className="flex flex-col gap-4">
              <h3 className={formHeading}>Partner of {person.name}</h3>
              <PersonFields defaults={{ gender: opposite(person.gender) }} />
              <fieldset className="flex gap-5">
                <legend className="sr-only">Status</legend>
                <label className={choiceLabel}>
                  <input type="radio" name="status" value="married" defaultChecked className={choice} /> Married
                </label>
                <label className={choiceLabel}>
                  <input type="radio" name="status" value="divorced" className={choice} /> Divorced
                </label>
              </fieldset>
              <OwnSheetBox name="ownSheet" checked hint="For someone who married in: a tab for their parents and cousins." />
              <SubmitRow label="Add partner" pending={pending} onCancel={back} />
            </form>
          )}

          {mode === "child" && (
            <form aria-label="Add child" onSubmit={submit((form) => {
              const read = readPerson(form);
              if (typeof read === "string") return read;
              const couple = String(form.get("couple") ?? "");
              return addChildOps(tree, person.id, couple || null, read);
            })} className="flex flex-col gap-4">
              <h3 className={formHeading}>Child of {person.name}</h3>
              <label className={fieldLabel}>
                Other parent
                <select name="couple" defaultValue={couples.find((c) => c.partner)?.union.id ?? ""} className={field}>
                  {couples.filter((c) => c.partner).map((c) => (
                    <option key={c.union.id} value={c.union.id}>
                      with {c.partner!.name}
                    </option>
                  ))}
                  <option value={couples.find((c) => !c.partner)?.union.id ?? ""}>on their own</option>
                </select>
              </label>
              <PersonFields />
              <SubmitRow label="Add child" pending={pending} onCancel={back} />
            </form>
          )}

          {mode === "sheet" && (
            <form aria-label="Show on another sheet" onSubmit={submit((form) => showOnSheetOps(String(form.get("sheet")), person.id))} className="flex flex-col gap-4">
              <h3 className={formHeading}>Show {person.name} on</h3>
              <select name="sheet" aria-label="Sheet" className={field}>
                {otherSheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <SubmitRow label="Show" pending={pending} onCancel={back} />
            </form>
          )}

          {mode === "ownSheet" && (
            <form aria-label="Create their own sheet" onSubmit={submit((form) => {
              const title = String(form.get("title") ?? "").trim();
              if (!title || title.length > 120) return "Enter a title of up to 120 characters.";
              return newSheetOps(person.id, title, String(form.get("hideChildrenOf") ?? "") || undefined);
            })} className="flex flex-col gap-4">
              <h3 className={formHeading}>{person.name}&apos;s own sheet</h3>
              <label className={fieldLabel}>
                Sheet title
                <input name="title" defaultValue={`${person.name}'s family`} maxLength={120} className={field} />
              </label>
              {withChildren.length > 0 && (
                <fieldset className="flex flex-col gap-2 text-sm">
                  <legend className="mb-1.5 font-medium">{their === "her" ? "Her" : "His"} children</legend>
                  {withChildren.map((c, i) => (
                    <label key={c.union.id} className="flex items-start gap-2.5">
                      <input type="radio" name="hideChildrenOf" value={c.union.id} defaultChecked={their === "her" && i === 0} className={`${choice} mt-0.5`} />
                      <span>Leave out {their} children {c.partner ? `with ${c.partner.name}` : "with no other parent"}</span>
                    </label>
                  ))}
                  <label className="flex items-start gap-2.5">
                    <input type="radio" name="hideChildrenOf" value="" defaultChecked={their === "his"} className={`${choice} mt-0.5`} />
                    <span>Show all {their} children</span>
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Leaving them out makes a tab for {their} side of the family: {their} parents, brothers and sisters show there, not on
                    those children&apos;s sheets.
                  </p>
                </fieldset>
              )}
              <SubmitRow label="Create sheet" pending={pending} onCancel={back} />
            </form>
          )}

          <Problem error={formError} />
        </div>
      )}
    </aside>
  );
}

function Problem({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className={formErrorClass}>
      {error}
    </p>
  ) : null;
}
