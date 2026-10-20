"use client";

import { useState, type FormEvent } from "react";
import type { Operation } from "@/server/operations/schema";
import { addChildOps, addParentsOps, addPartnerOps, editPersonOps, relationsOf, showOnSheetOps, tabOrder, type NewParent } from "@/tree/edits";
import { buildSheetView } from "@/tree/sheet-view";
import type { Gender, GroupTree, Person } from "@/tree/types";
import { formatYears } from "@/tree/years";
import { PersonPhoto } from "../PersonPhoto";
import { PersonFields, readPerson, SubmitRow } from "./person-form";
import { PhotoControls, type SignPhotoUpload } from "./PhotoControls";

type Mode = "details" | "edit" | "parents" | "partner" | "child" | "sheet";

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
 * sheets (an owner request after step 11): `onOpenSheet` opens one, as its tab would.
 */
export function PersonPanel({
  person,
  onDelete,
  signPhotoUpload,
  currentSheetId,
  onOpenSheet,
  ...props
}: PanelProps & {
  person: Person;
  onDelete: (person: Person) => void;
  signPhotoUpload?: SignPhotoUpload;
  currentSheetId: string;
  onOpenSheet: (sheetId: string) => void;
}) {
  const { tree, canEdit, pending, run, onSelect, onClose } = props;
  const [mode, setMode] = useState<Mode>("details");
  const [formError, setFormError] = useState<string | null>(null);
  const { parents, couples } = relationsOf(tree, person.id);
  // The other parent's gender as chosen in the form: a mother gets the "own sheet" option.
  const [otherGender, setOtherGender] = useState<Gender | null>(null);
  const otherIsMother = parents.length === 1 && (otherGender ?? opposite(parents[0].gender)) === "female";
  const years = formatYears(person.birthYear, person.deathYear);

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

  return (
    <aside aria-label="Person details" className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-200 bg-white p-4 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <PersonPhoto person={person} size={72} />
          <div>
            <h2 className="text-lg font-semibold">{person.name}</h2>
            {years && <p className="text-sm text-zinc-500 dark:text-zinc-400">{years}</p>}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
          Close
        </button>
      </div>

      {mode === "details" && (
        <>
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
          {ownSheets.length > 0 && (
            <div className="flex flex-col items-start gap-2">
              {ownSheets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenSheet(s.id)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-left text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Go to {s.title}
                </button>
              ))}
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
                ] as const
              ).map(([m, label, shown]) =>
                shown ? (
                  <button key={m} type="button" onClick={() => setMode(m)} disabled={pending} className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    {label}
                  </button>
                ) : null,
              )}
              <button type="button" onClick={() => onDelete(person)} disabled={pending} className="rounded px-2 py-1 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50">
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

      {formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {formError}
        </p>
      )}
    </aside>
  );
}
