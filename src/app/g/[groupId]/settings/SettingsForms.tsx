"use client";

import { useActionState, useState } from "react";
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

/** Hand the group to another member. The Owner becomes an Admin; confirmed by typing the group's name. */
export function TransferForm({ name, members, action }: { name: string; members: { userId: string; name: string; role: string }[]; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (members.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">There&apos;s nobody else in the group yet. Invite someone from the Members page first.</p>;
  }
  return (
    <form action={formAction} aria-label="Transfer ownership" className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The new owner gets every right you have now, and you become an Admin. Type <strong>{name}</strong> to confirm.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        New owner
        <select name="userId" required className={input}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Confirm the group&apos;s name
        <input name="confirm" required autoComplete="off" className={input} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
          {pending ? "Transferring…" : "Transfer ownership"}
        </button>
      </div>
    </form>
  );
}

/** Leave the group, after a second click. Coming back needs a new invite or request. */
export function LeaveForm({ name, action }: { name: string; action: () => Promise<SettingsFormState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {confirming ? (
        <form action={formAction} className="flex flex-wrap items-center gap-3 text-sm">
          <span>Leave {name}? To come back, you&apos;ll need a new invite.</span>
          <button type="submit" disabled={pending} className="rounded-full bg-red-700 px-5 py-2 font-medium text-white disabled:opacity-60">
            {pending ? "Leaving…" : "Leave"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-4 py-2 hover:bg-zinc-100">
            Cancel
          </button>
        </form>
      ) : (
        <div>
          <button type="button" onClick={() => setConfirming(true)} className="rounded-full border border-red-300 px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
            Leave this group
          </button>
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </div>
  );
}
