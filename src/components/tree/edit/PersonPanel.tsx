"use client";

import { useState, type FormEvent } from "react";
import type { Operation } from "@/server/operations/schema";
import { addChildOps, addParentsOps, addPartnerOps, editPersonOps, newSheetOps, relationsOf, showOnSheetOps, tabOrder, type NewParent } from "@/tree/edits";
import { EVERYONE } from "@/tree/everyone";
import { buildSheetView } from "@/tree/sheet-view";
import type { Gender, GroupTree, Person } from "@/tree/types";
import { formatLife, formatYears } from "@/tree/years";
import { PersonPhoto } from "../PersonPhoto";
import { detailsPanel } from "./panel";
import { input, PersonFields, readPerson, SubmitRow } from "./person-form";
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

function PersonLink({ p, onSelect }: { p: Person; onSelect: (personId: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(p.id)} className="text-left underline decoration-zinc-300 hover:decoration-zinc-900 dark:decoration-zinc-600 dark:hover:decoration-zinc-100">
      {p.name}
    </button>
  );
}

/**
 * "Create their own sheet": a tab rooted at the new person. Checked for a partner, who usually married
 * in; an option for a mother (an owner request after step 11), whose sheet leaves out her children
 * with the father.
 */
function OwnSheetBox({ name, checked = false, hint }: { name: string; checked?: boolean; hint: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1" />
      <span>
        Create their own sheet
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
      </span>
    </label>
  );
}

const MOTHER_SHEET_HINT = "a tab for her side of the family: her parents, brothers and sisters.";

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

  /** Reads a form, builds its operations, and goes back to the details once saved. */
  const submit = (build: (form: FormData) => Operation[] | string) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const built = build(new FormData(event.currentTarget));
    if (typeof built === "string") return setFormError(built);
    setFormError(null);
    if (built.length === 0) return setMode("details");
    if (await run(built)) setMode("details");
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
  // Create their own sheet (an owner request after the final check): for someone without one. A woman's
  // starts by leaving out her children with her (first) partner, like a mother's sheet from Add
  // parents; a man's shows all his children, like a partner who married in.
  const hasOwnSheet = tree.sheets.some((s) => s.rootPersonId === person.id);
  const withChildren = couples.filter((c) => c.children.length > 0);
  const their = person.gender === "female" ? "her" : "his";

  return (
    <aside aria-label="Person details" className={detailsPanel(mode !== "details")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <PersonPhoto person={person} size={72} />
          <div>
            <h2 className="text-lg font-semibold">{person.name}</h2>
            {dates && <p className="text-sm text-zinc-500 dark:text-zinc-400">{dates}</p>}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:bg-zinc-800">
          Close
        </button>
      </div>

      {mode === "details" && (
        <>
          {relation && (
            <div aria-label="Relation" role="group" className="flex flex-col items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
              {relation.names ? (
                <>
                  <p className="font-semibold">{relation.names}</p>
                  <p className="text-zinc-600 dark:text-zinc-400">{relation.path}</p>
                </>
              ) : (
                <p className="font-semibold">In the middle of the wheel</p>
              )}
              {relation.onMiddle && (
                <button type="button" onClick={relation.onMiddle} className="rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700 pointer-coarse:min-h-11 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                  Put in the middle
                </button>
              )}
            </div>
          )}
          {canEdit && signPhotoUpload && (
            <PhotoControls person={person} signUpload={signPhotoUpload} pending={pending} run={run} onError={setFormError} />
          )}
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Parents</dt>
              <dd className="flex flex-col">{parents.length ? parents.map((p) => <PersonLink key={p.id} p={p} onSelect={onSelect} />) : "Not added"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Partners</dt>
              <dd className="flex flex-col">
                {couples.some((c) => c.partner)
                  ? couples.flatMap((c) =>
                      c.partner ? [<span key={c.union.id}><PersonLink p={c.partner} onSelect={onSelect} />{c.union.status === "divorced" && " (divorced)"}</span>] : [],
                    )
                  : "None"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Children</dt>
              <dd className="flex flex-col">
                {couples.some((c) => c.children.length) ? couples.flatMap((c) => c.children.map((p) => <PersonLink key={p.id} p={p} onSelect={onSelect} />)) : "None"}
              </dd>
            </div>
          </dl>
          {(jumps.length > 0 || onFindInList || onShowInNetwork || onShowWheel) && (
            <div className="flex flex-col items-start gap-2">
              {jumps.map((jump) => (
                <button
                  key={jump.id}
                  type="button"
                  onClick={() => onOpenSheet(jump.id)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-left text-sm font-medium hover:bg-zinc-100 pointer-coarse:min-h-11 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {jump.label}
                </button>
              ))}
              {onFindInList && (
                <button type="button" onClick={onFindInList} className="rounded-full border border-zinc-300 px-3 py-1 text-left text-sm font-medium hover:bg-zinc-100 pointer-coarse:min-h-11 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Find in list
                </button>
              )}
              {onShowInNetwork && (
                <button type="button" onClick={onShowInNetwork} className="rounded-full border border-zinc-300 px-3 py-1 text-left text-sm font-medium hover:bg-zinc-100 pointer-coarse:min-h-11 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Show in network
                </button>
              )}
              {onShowWheel && (
                <button type="button" onClick={onShowWheel} className="rounded-full border border-zinc-300 px-3 py-1 text-left text-sm font-medium hover:bg-zinc-100 pointer-coarse:min-h-11 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Relatives wheel
                </button>
              )}
            </div>
          )}
          {canEdit && (
            <div className="flex flex-col items-start gap-1 text-sm">
              {(
                [
                  ["edit", "Edit details", true],
                  ["parents", parents.length === 1 ? "Add the other parent" : "Add parents", parents.length < 2],
                  ["partner", "Add partner", true],
                  ["child", "Add child", true],
                  ["sheet", "Show on another sheet", otherSheets.length > 0],
                  ["ownSheet", "Create their own sheet", !hasOwnSheet],
                ] as const
              ).map(([m, label, shown]) =>
                shown ? (
                  <button key={m} type="button" onClick={() => setMode(m)} disabled={pending} className="rounded px-2 py-1 hover:bg-zinc-100 pointer-coarse:min-h-11 dark:hover:bg-zinc-800">
                    {label}
                  </button>
                ) : null,
              )}
              <button type="button" onClick={() => onDelete(person)} disabled={pending} className="rounded px-2 py-1 text-red-700 hover:bg-red-50 pointer-coarse:min-h-11 dark:text-red-400 dark:hover:bg-red-950/50">
                Delete
              </button>
            </div>
          )}
        </>
      )}

      {mode === "edit" && (
        <form aria-label="Edit details" onSubmit={submit((form) => {
          const read = readPerson(form);
          return typeof read === "string" ? read : editPersonOps(person, read, tree.sheets);
        })} className="flex flex-col gap-3">
          <h3 className="font-medium">Edit details</h3>
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
          if (ownSheet("mother-") && String(form.get("mother-name") ?? "").trim() === "") return "Enter the mother's name, or uncheck Create their own sheet.";
          const entered: NewParent[] = [];
          for (const [prefix, who] of [["father-", "Father"], ["mother-", "Mother"]] as const) {
            if (String(form.get(`${prefix}name`) ?? "").trim() === "") continue; // either may be left out
            const read = readPerson(form, prefix, who);
            if (typeof read === "string") return read;
            entered.push({ ...read, ownSheet: ownSheet(prefix) });
          }
          return entered.length ? addParentsOps(tree, person.id, entered) : "Enter at least one parent's name.";
        })} className="flex flex-col gap-3">
          {parents.length === 1 ? (
            <>
              <h3 className="font-medium">The other parent of {person.name}</h3>
              <PersonFields prefix="other-" defaults={{ gender: opposite(parents[0].gender) }} />
              {otherIsMother && <OwnSheetBox name="other-ownSheet" hint={`For the mother: ${MOTHER_SHEET_HINT}`} />}
            </>
          ) : (
            <>
              <h3 className="font-medium">Parents of {person.name}</h3>
              <PersonFields prefix="father-" who="Father" fixedGender="male" />
              <PersonFields prefix="mother-" who="Mother" fixedGender="female" />
              <OwnSheetBox name="mother-ownSheet" hint={`For the mother: ${MOTHER_SHEET_HINT}`} />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Leave one out if you don&apos;t know them yet.</p>
            </>
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
        })} className="flex flex-col gap-3">
          <h3 className="font-medium">Partner of {person.name}</h3>
          <PersonFields defaults={{ gender: opposite(person.gender) }} />
          <fieldset className="flex gap-4 text-sm">
            <legend className="sr-only">Status</legend>
            <label className="flex items-center gap-1">
              <input type="radio" name="status" value="married" defaultChecked /> Married
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="status" value="divorced" /> Divorced
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
        })} className="flex flex-col gap-3">
          <h3 className="font-medium">Child of {person.name}</h3>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Other parent
            <select name="couple" defaultValue={couples.find((c) => c.partner)?.union.id ?? ""} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
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
        <form aria-label="Show on another sheet" onSubmit={submit((form) => showOnSheetOps(String(form.get("sheet")), person.id))} className="flex flex-col gap-3">
          <h3 className="font-medium">Show {person.name} on</h3>
          <select name="sheet" aria-label="Sheet" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
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
        })} className="flex flex-col gap-3">
          <h3 className="font-medium">{person.name}&apos;s own sheet</h3>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Sheet title
            <input name="title" defaultValue={`${person.name}'s family`} maxLength={120} className={input} />
          </label>
          {withChildren.length > 0 && (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-medium">{their === "her" ? "Her" : "His"} children</legend>
              {withChildren.map((c, i) => (
                <label key={c.union.id} className="flex items-start gap-2">
                  <input type="radio" name="hideChildrenOf" value={c.union.id} defaultChecked={their === "her" && i === 0} className="mt-1" />
                  <span>Leave out {their} children {c.partner ? `with ${c.partner.name}` : "with no other parent"}</span>
                </label>
              ))}
              <label className="flex items-start gap-2">
                <input type="radio" name="hideChildrenOf" value="" defaultChecked={their === "his"} className="mt-1" />
                <span>Show all {their} children</span>
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Leaving them out makes a tab for {their} side of the family: {their} parents, brothers and sisters.
              </p>
            </fieldset>
          )}
          <SubmitRow label="Create sheet" pending={pending} onCancel={back} />
        </form>
      )}

      {formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {formError}
        </p>
      )}
    </aside>
  );
}
