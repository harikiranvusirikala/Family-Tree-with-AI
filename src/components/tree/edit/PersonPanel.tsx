"use client";

import { useState, type FormEvent } from "react";
import type { Operation } from "@/server/operations/schema";
import { addChildOps, addParentsOps, addPartnerOps, editPersonOps, relationsOf, showOnSheetOps, type NewPerson } from "@/tree/edits";
import { buildSheetView } from "@/tree/sheet-view";
import type { GroupTree, Person } from "@/tree/types";
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
 * F6: one person's details and, for Maintain and up, what can be done with them. `signPhotoUpload` is
 * given when they may change photos and photos are set up (F8).
 */
export function PersonPanel({
  person,
  onDelete,
  signPhotoUpload,
  ...props
}: PanelProps & { person: Person; onDelete: (person: Person) => void; signPhotoUpload?: SignPhotoUpload }) {
  const { tree, canEdit, pending, run, onSelect, onClose } = props;
  const [mode, setMode] = useState<Mode>("details");
  const [formError, setFormError] = useState<string | null>(null);
  const { parents, couples } = relationsOf(tree, person.id);
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
          return typeof read === "string" ? read : editPersonOps(person, read);
        })} className="flex flex-col gap-3">
          <h3 className="font-medium">Edit details</h3>
          <PersonFields defaults={person} />
          <SubmitRow label="Save" pending={pending} onCancel={back} />
        </form>
      )}

      {mode === "parents" && (
        <form aria-label="Add parents" onSubmit={submit((form) => {
          if (parents.length === 1) {
            const read = readPerson(form, "other-");
            return typeof read === "string" ? read : addParentsOps(tree, person.id, [read]);
          }
          const entered: NewPerson[] = [];
          for (const [prefix, who] of [["father-", "Father"], ["mother-", "Mother"]] as const) {
            if (String(form.get(`${prefix}name`) ?? "").trim() === "") continue; // either may be left out
            const read = readPerson(form, prefix, who);
            if (typeof read === "string") return read;
            entered.push(read);
          }
          return entered.length ? addParentsOps(tree, person.id, entered) : "Enter at least one parent's name.";
        })} className="flex flex-col gap-3">
          {parents.length === 1 ? (
            <>
              <h3 className="font-medium">The other parent of {person.name}</h3>
              <PersonFields prefix="other-" defaults={{ gender: opposite(parents[0].gender) }} />
            </>
          ) : (
            <>
              <h3 className="font-medium">Parents of {person.name}</h3>
              <PersonFields prefix="father-" who="Father" fixedGender="male" />
              <PersonFields prefix="mother-" who="Mother" fixedGender="female" />
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
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="ownSheet" defaultChecked className="mt-1" />
            <span>
              Create their own sheet
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">For someone who married in: a tab for their parents and cousins.</span>
            </span>
          </label>
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
