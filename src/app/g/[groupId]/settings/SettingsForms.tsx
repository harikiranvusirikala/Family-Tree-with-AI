"use client";

import { useActionState } from "react";
import type { SettingsFormState } from "./actions";

type Action = (previous: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

const input = "w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

export function RenameForm({ name, action }: { name: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Group name
        <input name="name" required maxLength={120} defaultValue={name} className={input} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.saved && !pending && <p role="status" className="text-sm text-green-700">Saved.</p>}
      <div>
        <button type="submit" disabled={pending} className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
          {pending ? "Saving…" : "Rename"}
        </button>
      </div>
    </form>
  );
}

export function DeleteForm({ name, action }: { name: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The group disappears for everyone in it. Type <strong>{name}</strong> to confirm.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Confirm the group&apos;s name
        <input name="confirm" required autoComplete="off" className={input} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className="rounded-full bg-red-700 px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Deleting…" : "Delete group"}
        </button>
      </div>
    </form>
  );
}
