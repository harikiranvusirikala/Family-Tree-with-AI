"use client";

import { useState } from "react";
import { z } from "zod";
import { day, month, personName, year } from "@/server/operations/schema";
import type { NewPerson } from "@/tree/edits";
import type { Gender } from "@/tree/types";
import { datesProblem, MONTHS } from "@/tree/years";

// The server's own rules (schema.ts), so a form shows the same limits applyOperations enforces.
const personFields = z.strictObject({
  name: personName,
  gender: z.enum(["male", "female"], { error: "Choose male or female" }),
  birthYear: year.optional(),
  birthMonth: month.optional(),
  birthDay: day.optional(),
  deathYear: year.optional(),
  deathMonth: month.optional(),
  deathDay: day.optional(),
});

const LABELS: Record<string, string> = {
  name: "Name",
  gender: "Gender",
  birthYear: "Birth year",
  birthMonth: "Birth month",
  birthDay: "Birth day",
  deathYear: "Death year",
  deathMonth: "Death month",
  deathDay: "Death day",
};

/**
 * Reads the fields written by <PersonFields prefix>: the person, or an error message (a string).
 * `who` names the person in messages ("Father").
 */
export function readPerson(form: FormData, prefix = "", who = ""): NewPerson | string {
  const text = (key: string) => String(form.get(prefix + key) ?? "").trim();
  const numberOf = (key: string) => (text(key) === "" ? undefined : Number(text(key)));
  // The death fields count only while "Has died" is checked (unchecked, saving clears them).
  const died = form.get(`${prefix}died`) === "on";
  const dateKeys = ["birthYear", "birthMonth", "birthDay", ...(died ? ["deathYear", "deathMonth", "deathDay"] : [])];
  const parsed = personFields.safeParse({
    name: text("name"),
    gender: text("gender") || undefined,
    ...Object.fromEntries(dateKeys.map((key) => [key, numberOf(key)])),
  });
  const say = (message: string) => `${who ? `${who}: ` : ""}${message}.`;
  if (!parsed.success) {
    const { path, message } = parsed.error.issues[0];
    return say(path[0] === "name" ? message : `${LABELS[String(path[0])]}: ${message}`);
  }
  const problem = datesProblem(parsed.data); // the planner's own rules
  return problem ? say(problem) : parsed.data;
}

export const input = "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

/** Day, month and year of a birth or death; the day and month only when known. */
function DateFields({ what, prefix, label, defaults }: { what: "birth" | "death"; prefix: string; label: (text: string) => string; defaults?: Partial<NewPerson> }) {
  const word = what === "birth" ? "Birth" : "Death";
  const caption = "flex flex-col gap-0.5 text-xs text-zinc-500 dark:text-zinc-400";
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{label(what === "birth" ? "Born" : "Died")}</legend>
      <div className="grid grid-cols-[4.5rem_1fr_6rem] gap-2">
        <label className={caption}>
          Day
          <input name={`${prefix}${what}Day`} aria-label={label(`${word} day`)} type="number" inputMode="numeric" min={1} max={31} defaultValue={defaults?.[`${what}Day`]} className={input} />
        </label>
        <label className={caption}>
          Month
          <select name={`${prefix}${what}Month`} aria-label={label(`${word} month`)} defaultValue={defaults?.[`${what}Month`] ?? ""} className={input}>
            <option value="">–</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className={caption}>
          Year
          <input name={`${prefix}${what}Year`} aria-label={label(`${word} year`)} type="number" inputMode="numeric" defaultValue={defaults?.[`${what}Year`]} className={input} />
        </label>
      </div>
    </fieldset>
  );
}

/**
 * Name, gender and dates: each a year, with a day and month when known (an owner request after the
 * final check). The death's fields show once "Has died" is checked, as it starts for someone with a
 * death year (another owner request). With `fixedGender` the gender isn't asked (a father is male).
 * Labels start with `who` when given ("Father's name").
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
  const [died, setDied] = useState(defaults?.deathYear !== undefined);
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
      <DateFields what="birth" prefix={prefix} label={label} defaults={defaults} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={`${prefix}died`} checked={died} onChange={(event) => setDied(event.target.checked)} />
        {who ? `${who} has died` : "Has died"}
      </label>
      {died && <DateFields what="death" prefix={prefix} label={label} defaults={defaults} />}
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
