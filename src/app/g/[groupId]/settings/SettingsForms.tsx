"use client";

import { startTransition, useActionState, useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { button } from "@/components/ui/button";
import { cardText } from "@/components/ui/card";
import { DialogActions, DialogButton } from "@/components/ui/Dialog";
import { field, fieldHint, fieldLabel, formError } from "@/components/ui/field";
import { LineIcon } from "@/components/ui/icons";
import type { SettingsFormState } from "./actions";

type Action = (previous: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

function Problem({ state }: { state: SettingsFormState }) {
  return state.error ? (
    <p role="alert" className={formError}>
      {state.error}
    </p>
  ) : null;
}

/** The group's name, with Rename beside it. */
export function RenameForm({ name, action }: { name: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Group name</span>
          <input name="name" required maxLength={120} defaultValue={name} className={field} />
        </label>
        <button type="submit" disabled={pending} className={button("primary")}>
          {pending ? "Saving…" : "Rename"}
        </button>
      </div>
      <Problem state={state} />
      {state.saved && !pending && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Saved.
        </p>
      )}
    </form>
  );
}

/**
 * A dialog's form for something that can't be taken back, confirmed by typing the group's name. Its
 * button waits for the name (the server checks again). Sent without React's form reset, so a refused
 * attempt keeps what was typed and the button stays in step with it.
 */
function ConfirmByName(props: { name: string; action: Action; fields?: ReactNode; submit: string; busy: string; danger?: boolean; onCancel: () => void }) {
  const { name, action, fields, submit, busy, danger = false, onCancel } = props;
  const [state, dispatch, pending] = useActionState(action, {});
  const [typed, setTyped] = useState("");
  const hint = useId();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }
  return (
    <form onSubmit={onSubmit} aria-label={submit} className="flex flex-col gap-5">
      {fields}
      <div className="flex flex-col gap-1.5">
        <label className={fieldLabel}>
          Confirm the group&apos;s name
          <input name="confirm" required autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} aria-describedby={hint} className={field} />
        </label>
        <p id={hint} className={fieldHint}>
          Type <strong className="font-semibold text-zinc-700 dark:text-zinc-200">{name}</strong> to confirm.
        </p>
      </div>
      <Problem state={state} />
      <DialogActions>
        <button type="button" onClick={onCancel} className={button("ghost")}>
          Cancel
        </button>
        <button type="submit" disabled={pending || typed.trim() !== name} className={button(danger ? "danger" : "primary")}>
          {pending ? busy : submit}
        </button>
      </DialogActions>
    </form>
  );
}

/** The new owner is chosen here and confirmed in a dialog, by typing the group's name. The Owner becomes an Admin. */
export function TransferOwnership({ groupId, name, members, action }: { groupId: string; name: string; members: { userId: string; name: string; role: string }[]; action: Action }) {
  const [userId, setUserId] = useState(members[0]?.userId ?? "");
  if (members.length === 0) {
    return (
      <p className={cardText}>
        There&apos;s nobody else in the group yet.{" "}
        <Link href={`/g/${groupId}/members`} className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">
          Invite someone
        </Link>{" "}
        from the Members page first.
      </p>
    );
  }
  const chosen = members.find((m) => m.userId === userId) ?? members[0];
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className="min-w-0 flex-1">
        <span className="sr-only">New owner</span>
        <select value={chosen.userId} onChange={(e) => setUserId(e.target.value)} className={field}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>
      </label>
      <DialogButton
        title="Transfer ownership"
        description={
          <>
            Make <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{chosen.name}</strong> the owner of {name}? They get every right you
            have now, and you become an Admin.
          </>
        }
        buttonClassName={button("secondary")}
        button="Transfer ownership…"
      >
        {(close) => (
          <ConfirmByName
            name={name}
            action={action}
            fields={<input type="hidden" name="userId" value={chosen.userId} />}
            submit="Transfer ownership"
            busy="Transferring…"
            onCancel={close}
          />
        )}
      </DialogButton>
    </div>
  );
}

/** Delete group…, confirmed in a dialog by typing the group's name. */
export function DeleteGroup({ name, members, action }: { name: string; members: number; action: Action }) {
  return (
    <DialogButton
      title="Delete this group"
      description={`${name} disappears for everyone in it (${members === 1 ? "1 member" : `${members} members`}).`}
      buttonClassName={button("danger")}
      button={
        <>
          <LineIcon name="trash" className="size-4" />
          Delete group…
        </>
      }
    >
      {(close) => <ConfirmByName name={name} action={action} submit="Delete group" busy="Deleting…" danger onCancel={close} />}
    </DialogButton>
  );
}

/** Leave this group…, after a confirmation. Coming back needs a new invite or request. */
export function LeaveGroup({ name, action }: { name: string; action: () => Promise<SettingsFormState> }) {
  return (
    <DialogButton
      title={`Leave ${name}?`}
      description="To come back, you'll need a new invite."
      buttonClassName={button("dangerOutline")}
      button={
        <>
          <LineIcon name="logOut" className="size-4" />
          Leave this group…
        </>
      }
    >
      {(close) => <LeaveForm action={action} onCancel={close} />}
    </DialogButton>
  );
}

function LeaveForm({ action, onCancel }: { action: () => Promise<SettingsFormState>; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Problem state={state} />
      <DialogActions>
        <button type="button" data-autofocus onClick={onCancel} className={button("ghost")}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={button("danger")}>
          {pending ? "Leaving…" : "Leave"}
        </button>
      </DialogActions>
    </form>
  );
}
