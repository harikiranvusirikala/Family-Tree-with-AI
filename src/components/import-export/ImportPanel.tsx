"use client";

import { useRef, useState } from "react";
import { parseGedcom } from "@/server/import-export/gedcom";
import { defaultUseExisting, findDuplicates, importOperations, type ImportBatch } from "@/server/import-export/import-plan";
import { parseJson } from "@/server/import-export/json";
import type { ImportData } from "@/server/import-export/types";
import type { Gender, GroupTree } from "@/tree/types";
import { formatYears } from "@/tree/years";
import { button, iconButton } from "../ui/button";
import { compactField, field, fieldLabel, formError } from "../ui/field";
import { LineIcon } from "../ui/icons";

const quiet = button("ghost", "sm");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const withYears = (p: { name: string; birthYear?: number; deathYear?: number }) => {
  const years = formatYears(p.birthYear, p.deathYear);
  return years ? `${p.name} (${years})` : p.name;
};

/**
 * F10: import a JSON or GEDCOM file. The file is read here, in the browser (decided in step 10), and a
 * preview shows what will come in: counts, what isn't kept, warnings, possible duplicates (Use existing
 * by default, or Keep both), people needing a sex, and whose sheet opens. `onImport` sends the operations to
 * the server, which checks them like any edit; it returns a message if they weren't saved.
 */
export function ImportPanel({
  tree,
  targetGroupId,
  newGroup,
  onImport,
  onClose,
}: {
  /** The group imported into (empty for a new group), for finding duplicates. */
  tree: GroupTree;
  targetGroupId?: string;
  /** Importing into a new group: also asks for its name. */
  newGroup?: boolean;
  onImport: (batch: ImportBatch, groupName: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ImportData | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [genders, setGendersState] = useState<Record<string, Gender>>({});
  const [useExisting, setUseExistingState] = useState<Record<string, string>>({});
  // A new choice may answer the last message ("Choose male or female for …"), so it goes.
  const setGenders: typeof setGendersState = (next) => {
    setProblem(null);
    setGendersState(next);
  };
  const setUseExisting: typeof setUseExistingState = (next) => {
    setProblem(null);
    setUseExistingState(next);
  };
  const [root, setRoot] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function read(file: File) {
    setProblem(null);
    setData(null);
    const text = await file.text();
    const parsed = /\.json$/i.test(file.name) ? parseJson(text) : parseGedcom(text, file.name);
    if (typeof parsed === "string") return setProblem(parsed);
    setData(parsed);
    setGenders({});
    setUseExisting(newGroup ? {} : defaultUseExisting(findDuplicates(parsed, tree)));
    setRoot(parsed.persons[0]?.id ?? "");
    setName(parsed.suggestedName ?? "Imported family");
  }

  const duplicates = data && !newGroup ? findDuplicates(data, tree) : [];
  const unknownSex = data?.persons.filter((p) => p.gender === null) ?? [];
  const people = data ? [...data.persons].sort((a, b) => a.name.localeCompare(b.name)) : [];

  async function submit() {
    if (!data) return;
    if (newGroup && !name.trim()) return setProblem("Give the new group a name.");
    const batch = importOperations(data, { genders, useExisting, rootPersonId: root, targetGroupId, intoExistingGroup: !newGroup }, tree);
    if (typeof batch === "string") return setProblem(batch);
    setProblem(null);
    setBusy(true);
    try {
      const failed = await onImport(batch, name.trim());
      if (failed) setProblem(failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Import a family file" className="flex flex-col gap-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Import a family file</h2>
        <button type="button" onClick={onClose} aria-label="Close" className={`${iconButton} -mt-1 -mr-2`}>
          <LineIcon name="x" className="size-5" />
        </button>
      </div>
      <p className="text-zinc-600 dark:text-zinc-400">
        A GEDCOM file (.ged) from Ancestry, FamilySearch, MyHeritage or another program, or a JSON file exported from this app. Up to 2,000 people. Nothing is saved until you press Import.
      </p>
      <div>
        <input ref={picker} type="file" accept=".ged,.gedcom,.json" hidden onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        <button type="button" onClick={() => picker.current?.click()} disabled={busy} className={button("secondary")}>
          <LineIcon name="upload" className="size-4" />
          {data ? "Choose another file" : "Choose a file"}
        </button>
      </div>

      {data && (
        <div className="flex flex-col gap-4">
          <p role="status" className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 font-medium dark:border-zinc-800 dark:bg-zinc-950/50">
            {plural(data.persons.length, "person", "people")}, {plural(data.unions.length, "couple", "couples")}
            {data.sheets.length > 0 && `, ${plural(data.sheets.length, "sheet", "sheets")}`}
          </p>
          {data.notKept.length > 0 && <p className="text-zinc-600 dark:text-zinc-400">Not kept: {data.notKept.join(", ")}.</p>}
          {data.kind === "json" && data.sourceGroupId && data.sourceGroupId !== targetGroupId && data.persons.some((p) => p.photoId) && (
            <p className="text-zinc-600 dark:text-zinc-400">Photos aren&apos;t copied: they stay with the group the file came from.</p>
          )}
          {data.warnings.length > 0 && (
            <ul aria-label="Warnings" className="flex list-disc flex-col gap-1 pl-5 text-amber-800 dark:text-amber-300">
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {newGroup && (
            <label className={fieldLabel}>
              Name of the new group
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={field} />
            </label>
          )}

          {duplicates.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold">Possibly already in this group ({duplicates.length})</legend>
              <p className="text-zinc-600 dark:text-zinc-400">They&apos;re linked to the person already here. Choose Keep both to add them as someone new.</p>
              {duplicates.map(({ imported, existing }) => (
                <label key={imported.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{withYears(imported)}</span>
                  <select
                    aria-label={`What to do with ${imported.name}`}
                    value={useExisting[imported.id] ?? ""}
                    onChange={(e) => {
                      const choice = e.target.value;
                      setUseExisting((all) => {
                        const next = { ...all };
                        if (choice) next[imported.id] = choice;
                        else delete next[imported.id];
                        return next;
                      });
                    }}
                    className={compactField}
                  >
                    {existing.map((p) => (
                      <option key={p.id} value={p.id}>
                        Use existing {withYears(p)}
                      </option>
                    ))}
                    <option value="">Keep both</option>
                  </select>
                </label>
              ))}
            </fieldset>
          )}

          {unknownSex.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold">No sex recorded ({unknownSex.length})</legend>
              <p className="text-zinc-600 dark:text-zinc-400">The tree shows men and women with different colours, so choose for each.</p>
              {unknownSex.length > 3 && (
                <div className="flex items-center gap-2">
                  <span>Set all to</span>
                  {(["male", "female"] as const).map((g) => (
                    <button key={g} type="button" onClick={() => setGenders((all) => ({ ...all, ...Object.fromEntries(unknownSex.map((p) => [p.id, g])) }))} className={quiet}>
                      {g === "male" ? "Male" : "Female"}
                    </button>
                  ))}
                </div>
              )}
              {unknownSex.map((p) => (
                <label key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{withYears(p)}</span>
                  <select aria-label={`Sex of ${p.name}`} value={genders[p.id] ?? ""} onChange={(e) => setGenders((all) => ({ ...all, [p.id]: e.target.value as Gender }))} className={compactField}>
                    <option value="" disabled>
                      Choose…
                    </option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
              ))}
            </fieldset>
          )}

          {data.sheets.length === 0 && (
            <label className={fieldLabel}>
              The new sheet shows the family of
              <select value={root} onChange={(e) => setRoot(e.target.value)} className={field}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {withYears(p)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={submit} disabled={busy} className={button("primary")}>
              {busy ? "Importing…" : "Import"}
            </button>
            <button type="button" onClick={onClose} disabled={busy} className={button("ghost")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {problem && (
        <p role="alert" className={formError}>
          {problem}
        </p>
      )}
    </section>
  );
}
