"use client";

import { useState, type FormEvent } from "react";
import { addChildOps, coupleStatusOps, marriageDateOps } from "@/tree/edits";
import type { Union } from "@/tree/types";
import { formatMarriage } from "@/tree/years";
import { button, iconButton } from "../../ui/button";
import { formError as formErrorClass } from "../../ui/field";
import { LineIcon } from "../../ui/icons";
import { PersonPhoto } from "../PersonPhoto";
import { Relative, type PanelProps } from "./PersonPanel";
import { detailsPanel, panelBody, panelHeader, panelHeading, panelNote } from "./panel";
import { DateFields, PersonFields, readMarriage, readPerson, SubmitRow } from "./person-form";

/** Married or Divorced, as a segmented control (the production look). */
const statusButton =
  "flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 enabled:hover:text-zinc-900 aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-sm disabled:cursor-default pointer-coarse:min-h-11 dark:text-zinc-400 dark:enabled:hover:text-zinc-100 dark:aria-pressed:bg-zinc-900 dark:aria-pressed:text-zinc-100";
const linkButton =
  "rounded-md text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 outline-none hover:text-zinc-900 hover:decoration-zinc-500 focus-visible:ring-2 focus-visible:ring-blue-500/70 disabled:opacity-60 pointer-coarse:min-h-11 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-zinc-100";

/**
 * F6: a couple (the heart). Married or divorced, when they married (an owner request after the final
 * check), their children, and adding a child.
 */
export function CouplePanel({ union, tree, canEdit, pending, run, onSelect, onClose }: PanelProps & { union: Union }) {
  const [mode, setMode] = useState<"details" | "child" | "date">("details");
  const [formError, setFormError] = useState<string | null>(null);
  const married = formatMarriage(union);
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const partners = union.partnerIds.flatMap((id) => byId.get(id) ?? []);
  const children = union.childIds.flatMap((id) => byId.get(id) ?? []);

  async function addChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readPerson(new FormData(event.currentTarget));
    if (typeof read === "string") return setFormError(read);
    setFormError(null);
    if (await run(addChildOps(tree, union.partnerIds[0], union.id, read))) setMode("details");
  }

  async function saveDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readMarriage(new FormData(event.currentTarget));
    if (typeof read === "string") return setFormError(read);
    setFormError(null);
    const ops = marriageDateOps(union, read);
    if (ops.length === 0 || (await run(ops))) setMode("details");
  }

  function open(next: typeof mode) {
    setFormError(null);
    setMode(next);
  }

  return (
    <aside aria-label="Couple details" className={detailsPanel(mode !== "details")}>
      {mode === "details" && <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 md:hidden dark:bg-zinc-700" />}
      <div className={panelHeader}>
        <div className="flex shrink-0 -space-x-3">
          {partners.map((p) => (
            <PersonPhoto key={p.id} person={p} size={48} />
          ))}
        </div>
        <h2 className="min-w-0 flex-1 pt-1 text-lg leading-snug font-semibold tracking-tight">{partners.map((p) => p.name).join(" & ")}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className={`${iconButton} -mt-1 -mr-2`}>
          <LineIcon name="x" className="size-5" />
        </button>
      </div>

      <div className={panelBody}>
        <div role="group" aria-label="Status" className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60">
          {(["married", "divorced"] as const).map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={union.status === status}
              disabled={!canEdit || pending || union.status === status}
              onClick={() => run(coupleStatusOps(union.id, status))}
              className={statusButton}
            >
              {status === "married" ? "Married" : "Divorced"}
            </button>
          ))}
        </div>

        {mode === "date" ? (
          <form aria-label="Marriage date" onSubmit={saveDate} className="flex flex-col gap-4">
            <DateFields what="marriage" defaults={union} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">The day and month only if known. Empty the year to remove the date.</p>
            <SubmitRow label="Save" pending={pending} onCancel={() => open("details")} />
          </form>
        ) : (
          <section>
            <h3 className={panelHeading}>Married on</h3>
            <div className="flex flex-col items-start gap-1 px-2">
              <p className="text-sm">{married || "Not added"}</p>
              {canEdit && mode === "details" && (
                <button type="button" onClick={() => open("date")} disabled={pending} className={linkButton}>
                  {married ? "Change marriage date" : "Add marriage date"}
                </button>
              )}
            </div>
          </section>
        )}

        <section>
          <h3 className={panelHeading}>Children</h3>
          {children.length ? (
            <ul>
              {children.map((c) => (
                <Relative key={c.id} p={c} onSelect={onSelect} />
              ))}
            </ul>
          ) : (
            <p className={panelNote}>None yet</p>
          )}
        </section>

        {canEdit && mode === "child" && (
          <form aria-label="Add child" onSubmit={addChild} className="flex flex-col gap-4">
            <h3 className="text-base font-semibold tracking-tight">Their child</h3>
            <PersonFields />
            <SubmitRow label="Add child" pending={pending} onCancel={() => open("details")} />
          </form>
        )}
        {canEdit && mode === "details" && (
          <button type="button" onClick={() => open("child")} disabled={pending} className={button("secondary")}>
            <LineIcon name="plus" className="size-4" />
            Add child
          </button>
        )}

        {formError && (
          <p role="alert" className={formErrorClass}>
            {formError}
          </p>
        )}
      </div>
    </aside>
  );
}
