"use client";

import { z } from "zod";
import { personName, year } from "@/server/operations/schema";
import type { NewPerson } from "@/tree/edits";
import type { Gender } from "@/tree/types";

// The server's own rules (schema.ts), so a form shows the same limits applyOperations enforces.
const personFields = z.strictObject({
  name: personName,
  gender: z.enum(["male", "female"], { error: "Choose male or female" }),
  birthYear: year.optional(),
  deathYear: year.optional(),
});

const LABELS: Record<string, string> = { name: "Name", gender: "Gender", birthYear: "Birth year", deathYear: "Death year" };

/**
 * Reads the fields written by <PersonFields prefix>: the person, or an error message (a string).
 * `who` names the person in messages ("Father").
 */
export function readPerson(form: FormData, prefix = "", who = ""): NewPerson | string {
  const text = (key: string) => String(form.get(prefix + key) ?? "").trim();
  const yearOf = (key: string) => (text(key) === "" ? undefined : Number(text(key)));
  const parsed = personFields.safeParse({ name: text("name"), gender: text("gender") || undefined, birthYear: yearOf("birthYear"), deathYear: yearOf("deathYear") });
  const say = (message: string) => `${who ? `${who}: ` : ""}${message}.`;
  if (!parsed.success) {
    const { path, message } = parsed.error.issues[0];
    return say(path[0] === "name" ? message : `${LABELS[String(path[0])]}: ${message}`);
  }
  const { birthYear, deathYear } = parsed.data;
  if (birthYear !== undefined && deathYear !== undefined && deathYear < birthYear) return say("The death year can't be before the birth year");
  return parsed.data;
}

const input = "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

/**
 * Name, gender and years. With `fixedGender` the gender isn't asked (a father is male). Labels start
 * with `who` when given ("Father's name").
 */
export function PersonFields({
  prefix = "",
  who,
  defaults,
  fixedGender,
}: {
  prefix?: string;
  who?: string;
  defaults?: Partial<NewPerson>;
  fixedGender?: Gender;
}) {
  const label = (text: string) => (who ? `${who}'s ${text.toLowerCase()}` : text);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label("Name")}
        <input name={`${prefix}name`} maxLength={120} defaultValue={defaults?.name} className={input} />
      </label>
      {fixedGender ? (
        <input type="hidden" name={`${prefix}gender`} value={fixedGender} />
      ) : (
        <fieldset className="flex gap-4 text-sm">
          <legend className="sr-only">{label("Gender")}</legend>
          {(["male", "female"] as const).map((g) => (
            <label key={g} className="flex items-center gap-1">
              <input type="radio" name={`${prefix}gender`} value={g} defaultChecked={defaults?.gender === g} />
              {g === "male" ? "Male" : "Female"}
            </label>
          ))}
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {label("Birth year")}
          <input name={`${prefix}birthYear`} type="number" inputMode="numeric" defaultValue={defaults?.birthYear} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {label("Death year")}
          <input name={`${prefix}deathYear`} type="number" inputMode="numeric" defaultValue={defaults?.deathYear} className={input} />
        </label>
      </div>
    </div>
  );
}

export function SubmitRow({ label, pending, onCancel }: { label: string; pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <button type="submit" disabled={pending} className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 pointer-coarse:min-h-11 dark:bg-white dark:text-zinc-900">
        {pending ? "Saving…" : label}
      </button>
      <button type="button" onClick={onCancel} disabled={pending} className="rounded-full px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 pointer-coarse:min-h-11 dark:hover:bg-zinc-800 dark:text-zinc-400">
        Cancel
      </button>
    </div>
  );
}
