"use client";

import { useActionState, useState } from "react";
import { button } from "@/components/ui/button";
import { DialogActions, DialogButton } from "@/components/ui/Dialog";
import { choice, choiceLabel, field, fieldLabel, formError } from "@/components/ui/field";
import { LineIcon } from "@/components/ui/icons";
import { createGroupAction, type NewGroupFormState } from "./actions";

/** F2: group name, father's and mother's names, and optionally the user as their child. */
export function NewGroupForm({ myName, onCancel }: { myName: string; onCancel?: () => void }) {
  const [state, action, pending] = useActionState<NewGroupFormState, FormData>(createGroupAction, {});
  const [addMe, setAddMe] = useState(state.values ? state.values.addMe === "on" : true);
  const v = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className={fieldLabel}>
        Group name
        <input name="groupName" required maxLength={120} placeholder="e.g. The Sharma family" defaultValue={v.groupName} className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={fieldLabel}>
          Father&apos;s name
          <input name="fatherName" required maxLength={120} defaultValue={v.fatherName} className={field} />
        </label>
        <label className={fieldLabel}>
          Mother&apos;s name
          <input name="motherName" required maxLength={120} defaultValue={v.motherName} className={field} />
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
        <label className={choiceLabel}>
          <input type="checkbox" name="addMe" checked={addMe} onChange={(e) => setAddMe(e.target.checked)} className={choice} />
          Add me as their child
        </label>
        {addMe && (
          <fieldset className="mt-4 grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">You</legend>
            <label className={fieldLabel}>
              Your name
              <input name="myName" required maxLength={120} defaultValue={v.myName ?? myName} className={field} />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <span>You are</span>
              <div className="flex gap-5 font-normal">
                <label className={choiceLabel}>
                  <input type="radio" name="myGender" value="male" required defaultChecked={v.myGender === "male"} className={choice} /> Male
                </label>
                <label className={choiceLabel}>
                  <input type="radio" name="myGender" value="female" defaultChecked={v.myGender === "female"} className={choice} /> Female
                </label>
              </div>
            </div>
          </fieldset>
        )}
      </div>

      {state.error && (
        <p role="alert" className={formError}>
          {state.error}
        </p>
      )}
      <DialogActions>
        {onCancel && (
          <button type="button" onClick={onCancel} className={button("ghost")}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={pending} className={button("primary")}>
          {pending ? "Creating…" : "Create group"}
        </button>
      </DialogActions>
    </form>
  );
}

/**
 * "New group" (the page's main button), or the dashed card at the end of My groups: both open the
 * form in a dialog. Creating it opens the new group.
 */
export function NewGroupButton({ myName, look = "button" }: { myName: string; look?: "button" | "card" }) {
  return (
    <DialogButton
      title="Create a family group"
      description="Start with your parents' names: each side of the family gets its own sheet, and you add everyone else from there."
      buttonClassName={
        look === "button"
          ? button("primary")
          : "flex h-full min-h-28 w-full items-center gap-4 rounded-2xl border border-dashed border-zinc-300 p-5 text-left transition-colors outline-none hover:border-zinc-400 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
      }
      button={
        look === "button" ? (
          <>
            <LineIcon name="plus" className="size-4" />
            New group
          </>
        ) : (
          <>
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <LineIcon name="plus" className="size-5" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">Start a new group</span>
              <span className="block text-sm text-zinc-500 dark:text-zinc-400">Begin with your parents&apos; names.</span>
            </span>
          </>
        )
      }
    >
      {(close) => <NewGroupForm myName={myName} onCancel={close} />}
    </DialogButton>
  );
}
