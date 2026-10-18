"use client";

import { useActionState, useState } from "react";
import { createGroupAction, type NewGroupFormState } from "./actions";

const input = "w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

/** F2: group name, father's and mother's names, and optionally the user as their child. */
export function NewGroupForm({ myName }: { myName: string }) {
  const [state, action, pending] = useActionState<NewGroupFormState, FormData>(createGroupAction, {});
  const [addMe, setAddMe] = useState(state.values ? state.values.addMe === "on" : true);
  const v = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Group name
        <input name="groupName" required maxLength={120} placeholder="e.g. The Sharma family" defaultValue={v.groupName} className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Father&apos;s name
          <input name="fatherName" required maxLength={120} defaultValue={v.fatherName} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mother&apos;s name
          <input name="motherName" required maxLength={120} defaultValue={v.motherName} className={input} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="addMe" checked={addMe} onChange={(e) => setAddMe(e.target.checked)} />
        Add me as their child
      </label>
      {addMe && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">You</legend>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Your name
            <input name="myName" required maxLength={120} defaultValue={v.myName ?? myName} className={input} />
          </label>
          <div className="flex flex-col gap-1 text-sm font-medium">
            <span>You are</span>
            <div className="flex gap-4 py-2 font-normal">
              <label className="flex items-center gap-1">
                <input type="radio" name="myGender" value="male" required defaultChecked={v.myGender === "male"} /> Male
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="myGender" value="female" defaultChecked={v.myGender === "female"} /> Female
              </label>
            </div>
          </div>
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "Creating…" : "Create group"}
        </button>
      </div>
    </form>
  );
}
