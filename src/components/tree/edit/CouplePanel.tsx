"use client";

import { useState, type FormEvent } from "react";
import { addChildOps, coupleStatusOps } from "@/tree/edits";
import type { Union } from "@/tree/types";
import type { PanelProps } from "./PersonPanel";
import { detailsPanel } from "./panel";
import { PersonFields, readPerson, SubmitRow } from "./person-form";

/** F6: a couple (the heart). Married or divorced, their children, and adding a child. */
export function CouplePanel({ union, tree, canEdit, pending, run, onSelect, onClose }: PanelProps & { union: Union }) {
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const partners = union.partnerIds.flatMap((id) => byId.get(id) ?? []);
  const children = union.childIds.flatMap((id) => byId.get(id) ?? []);

  async function addChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readPerson(new FormData(event.currentTarget));
    if (typeof read === "string") return setFormError(read);
    setFormError(null);
    if (await run(addChildOps(tree, union.partnerIds[0], union.id, read))) setAdding(false);
  }

  return (
    <aside aria-label="Couple details" className={detailsPanel(adding)}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">{partners.map((p) => p.name).join(" & ")}</h2>
        <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:bg-zinc-800">
          Close
        </button>
      </div>

      <div className="flex gap-2 text-sm" role="group" aria-label="Status">
        {(["married", "divorced"] as const).map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={union.status === status}
            disabled={!canEdit || pending || union.status === status}
            onClick={() => run(coupleStatusOps(union.id, status))}
            className="rounded-full border border-zinc-300 px-3 py-1 aria-pressed:bg-zinc-900 aria-pressed:text-white disabled:cursor-default pointer-coarse:min-h-11 dark:border-zinc-700 dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900"
          >
            {status === "married" ? "Married" : "Divorced"}
          </button>
        ))}
      </div>

      <div className="text-sm">
        <p className="text-zinc-500 dark:text-zinc-400">Children</p>
        {children.length ? (
          <ul className="flex flex-col">
            {children.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onSelect(c.id)} className="underline decoration-zinc-300 hover:decoration-zinc-900 dark:decoration-zinc-600 dark:hover:decoration-zinc-100">
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>None yet</p>
        )}
      </div>

      {canEdit &&
        (adding ? (
          <form aria-label="Add child" onSubmit={addChild} className="flex flex-col gap-3">
            <h3 className="font-medium">Their child</h3>
            <PersonFields />
            <SubmitRow label="Add child" pending={pending} onCancel={() => setAdding(false)} />
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} disabled={pending} className="self-start rounded px-2 py-1 text-sm hover:bg-zinc-100 pointer-coarse:min-h-11 dark:hover:bg-zinc-800">
            Add child
          </button>
        ))}

      {formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {formError}
        </p>
      )}
    </aside>
  );
}
