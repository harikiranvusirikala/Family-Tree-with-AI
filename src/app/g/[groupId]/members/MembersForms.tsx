"use client";

import { useActionState, useState } from "react";
import { useHydrated } from "@/components/use-hydrated";
import { GRANTABLE_ROLES, ROLE_LABELS, type GrantableRole } from "@/server/members-rules";
import type { Role } from "@/server/roles";
import type { MemberFormState } from "./actions";

type FormAction = (previous: MemberFormState, formData: FormData) => Promise<MemberFormState>;
type ButtonAction = () => Promise<MemberFormState>;

const input = "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const button = "rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900";
const quiet = "rounded-full px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-800";

function RoleSelect({ label, defaultValue = "view" }: { label: string; defaultValue?: GrantableRole }) {
  return (
    <select name="role" aria-label={label} defaultValue={defaultValue} className={input}>
      {GRANTABLE_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

function Problem({ state }: { state: MemberFormState }) {
  return state.error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p> : null;
}

/** The link to share for an invite, with Copy. Built from this page's address, so previews give preview links. */
export function InviteLink({ token, label = "Invite link" }: { token: string; label?: string }) {
  const hydrated = useHydrated();
  const [copied, setCopied] = useState(false);
  const link = `${hydrated ? window.location.origin : ""}/invite/${token}`;
  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={link} aria-label={label} onFocus={(e) => e.currentTarget.select()} className={`${input} min-w-0 flex-1 font-mono text-xs`} />
      <button type="button" onClick={copy} disabled={!hydrated} className={quiet}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** F3: invite by email and role. The new invite's link appears below, to share by WhatsApp or text. */
export function InviteForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} aria-label="Invite someone" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium">
          Email
          <input name="email" type="email" required maxLength={254} placeholder="cousin@gmail.com" className={input} />
        </label>
        <RoleSelect label="Role" />
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>
      <Problem state={state} />
      {state.token && !pending && (
        <div role="status" className="flex flex-col gap-2 rounded-md bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-200">
          <p>{state.done}</p>
          <InviteLink token={state.token} label="New invite link" />
        </div>
      )}
    </form>
  );
}

/** A pending invite: who, the role, its link, and Revoke. */
export function InviteRow({ invite, revoke }: { invite: { email: string; role: GrantableRole; token: string; invitedBy: string; expires: string }; revoke: ButtonAction }) {
  const [state, revokeAction, pending] = useActionState(revoke, {});
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">{invite.email}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {ROLE_LABELS[invite.role]} · invited by {invite.invitedBy} · expires {invite.expires}
          </p>
        </div>
        <form action={revokeAction}>
          <button type="submit" disabled={pending} className={quiet}>
            Revoke
          </button>
        </form>
      </div>
      <InviteLink token={invite.token} label={`Invite link for ${invite.email}`} />
      <Problem state={state} />
    </li>
  );
}

/** A member: name, email and role. Admins and the Owner change the role or remove them; never the Owner's. */
export function MemberRow({
  member,
  isYou,
  changeRole,
  remove,
}: {
  member: { name: string; email: string; role: Role };
  isYou: boolean;
  changeRole: FormAction;
  remove: ButtonAction;
}) {
  const [roleState, roleAction, changing] = useActionState(changeRole, {});
  const [removeState, removeAction, removing] = useActionState(remove, {});
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {member.name}
            {isYou && <span className="text-zinc-500 dark:text-zinc-400"> (you)</span>}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{member.email}</p>
        </div>
        {member.role === "owner" ? (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Owner</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <form action={roleAction} className="flex items-center gap-2">
              {/* React resets a form after its action, to each field's first default; React never updates a
                  dropdown's default later. Keyed by the saved role, a new role brings a new dropdown. */}
              <RoleSelect key={member.role} label={`Role for ${member.name}`} defaultValue={member.role} />
              <button type="submit" disabled={changing} className={quiet}>
                Change role
              </button>
            </form>
            {confirming ? (
              <form action={removeAction} className="flex items-center gap-2 text-sm">
                <span>Remove {member.name}?</span>
                <button type="submit" disabled={removing} className="rounded-full bg-red-700 px-3 py-1.5 font-medium text-white disabled:opacity-60">
                  Remove
                </button>
                <button type="button" onClick={() => setConfirming(false)} className={quiet}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className={`${quiet} text-red-700 dark:text-red-400`}>
                Remove…
              </button>
            )}
          </div>
        )}
      </div>
      {roleState.done && !changing && <p role="status" className="text-sm text-green-700 dark:text-green-400">{roleState.done}</p>}
      <Problem state={roleState} />
      <Problem state={removeState} />
    </li>
  );
}

/** F4: a request waiting for an answer. Approve with a role (View by default), or Deny. */
export function RequestRow({ request, decide }: { request: { name: string; email: string; message?: string; date: string }; decide: FormAction }) {
  const [state, decideAction, pending] = useActionState(decide, {});
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div>
        <p className="font-medium">{request.name}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {request.email} · asked {request.date}
        </p>
      </div>
      {request.message && <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">“{request.message}”</p>}
      <form action={decideAction} className="flex flex-wrap items-center gap-2">
        <RoleSelect label={`Role for ${request.name}`} />
        <button type="submit" name="decision" value="approve" disabled={pending} className={button}>
          Approve
        </button>
        <button type="submit" name="decision" value="deny" disabled={pending} className={quiet}>
          Deny
        </button>
      </form>
      <Problem state={state} />
    </li>
  );
}
