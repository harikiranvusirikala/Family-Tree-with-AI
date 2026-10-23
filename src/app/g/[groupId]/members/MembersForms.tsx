"use client";

import { startTransition, useActionState, useId, useOptimistic, useRef, useState } from "react";
import { useHydrated } from "@/components/use-hydrated";
import { Avatar } from "@/components/ui/Avatar";
import { badge, quietBadge, ROLE_BADGE } from "@/components/ui/badge";
import { button, iconButton } from "@/components/ui/button";
import { Dialog, DialogActions, DialogButton } from "@/components/ui/Dialog";
import { choice, compactField, field, fieldHint, fieldLabel, formError, formSuccess, menuField } from "@/components/ui/field";
import { LineIcon } from "@/components/ui/icons";
import { dangerMenuItem, Menu, menuItem } from "@/components/ui/Menu";
import { GRANTABLE_ROLES, ROLE_HINTS, ROLE_LABELS, type GrantableRole } from "@/server/members-rules";
import type { Role } from "@/server/roles";
import type { MemberFormState } from "./actions";
import { MEMBER_COLUMNS } from "./columns";

type FormAction = (previous: MemberFormState, formData: FormData) => Promise<MemberFormState>;
type ButtonAction = () => Promise<MemberFormState>;

function Problem({ state }: { state: MemberFormState }) {
  return state.error ? (
    <p role="alert" className={formError}>
      {state.error}
    </p>
  ) : null;
}

/** An invite's link with Copy. Built from this page's address, so previews give preview links. */
export function InviteLink({ token, label }: { token: string; label: string }) {
  const hydrated = useHydrated();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const link = `${hydrated ? window.location.origin : ""}/invite/${token}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      input.current?.select(); // the browser won't: ready for Ctrl+C
    }
  }
  return (
    <div className="flex items-center gap-2">
      <input ref={input} readOnly value={link} aria-label={label} onFocus={(e) => e.currentTarget.select()} className={`${field} min-w-0 flex-1 font-mono`} />
      <button type="button" onClick={copy} disabled={!hydrated} className={button("secondary")}>
        <LineIcon name={copied ? "check" : "copy"} className="size-4" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** F3: Invite people, opening the invite form: an email and a role. */
export function InviteButton({ action }: { action: FormAction }) {
  return (
    <DialogButton
      title="Invite someone"
      description="They get a link to share by WhatsApp or text. It works only for that email's Google account, for 14 days."
      buttonClassName={button("primary")}
      button={
        <>
          <LineIcon name="userPlus" className="size-4" />
          Invite people
        </>
      }
    >
      {(close) => <InviteForm action={action} onDone={close} />}
    </DialogButton>
  );
}

/** The invite form. The new invite's link appears under it, to share; the form is ready for another. */
function InviteForm({ action, onDone }: { action: FormAction; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, {});
  const id = useId();
  return (
    <form action={formAction} aria-label="Invite someone" className="flex flex-col gap-5">
      <label className={fieldLabel}>
        Email
        <input name="email" type="email" required maxLength={254} placeholder="cousin@gmail.com" className={field} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">Role</legend>
        {GRANTABLE_ROLES.map((r) => (
          <label
            key={r}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 px-3.5 py-3 hover:bg-zinc-50 has-checked:border-zinc-900 has-checked:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40 dark:has-checked:border-zinc-300 dark:has-checked:bg-zinc-800/60"
          >
            <input
              type="radio"
              name="role"
              value={r}
              defaultChecked={r === "view"}
              aria-labelledby={`${id}-${r}`}
              aria-describedby={`${id}-${r}-hint`}
              className={`${choice} mt-0.5`}
            />
            <span className="flex flex-col gap-0.5">
              <span id={`${id}-${r}`} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {ROLE_LABELS[r]}
              </span>
              <span id={`${id}-${r}-hint`} className={fieldHint}>
                {ROLE_HINTS[r]}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <Problem state={state} />
      {state.token && !pending && (
        <div role="status" className={`${formSuccess} flex flex-col gap-2`}>
          <p>{state.done}</p>
          <InviteLink token={state.token} label="New invite link" />
        </div>
      )}
      <DialogActions>
        <button type="button" onClick={onDone} className={button("ghost")}>
          {state.token ? "Done" : "Cancel"}
        </button>
        <button type="submit" disabled={pending} className={button("primary")}>
          {pending ? "Inviting…" : "Invite"}
        </button>
      </DialogActions>
    </form>
  );
}

/** Copy link for a pending invite; if the browser won't copy, the row shows the link to copy by hand. */
function CopyLinkButton({ token, email, onFail }: { token: string; email: string; onFail: () => void }) {
  const hydrated = useHydrated();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onFail();
    }
  }
  return (
    <>
      <button type="button" onClick={copy} disabled={!hydrated} className={button("secondary", "sm")}>
        <LineIcon name={copied ? "check" : "copy"} className="size-4" />
        {copied ? (
          "Copied"
        ) : (
          <>
            Copy link<span className="sr-only"> for {email}</span>
          </>
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}

/** A pending invite: who, the role, Copy link and Revoke. */
export function InviteRow({ invite, revoke }: { invite: { email: string; role: GrantableRole; token: string; invitedBy: string; expires: string }; revoke: ButtonAction }) {
  const [state, revokeAction, pending] = useActionState(revoke, {});
  const [showLink, setShowLink] = useState(false);
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <LineIcon name="mail" className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{invite.email}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {ROLE_LABELS[invite.role]} · invited by {invite.invitedBy} · expires {invite.expires}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:shrink-0">
          <CopyLinkButton token={invite.token} email={invite.email} onFail={() => setShowLink(true)} />
          <form action={revokeAction}>
            <button type="submit" disabled={pending} className={button("dangerGhost", "sm")}>
              Revoke
            </button>
          </form>
        </div>
      </div>
      {showLink && <InviteLink token={invite.token} label={`Invite link for ${invite.email}`} />}
      <Problem state={state} />
    </li>
  );
}

/** A member's role as a menu: each role with what it lets them do, the current one ticked. Choosing one saves it. */
function RoleMenu({ name, role, onChange }: { name: string; role: GrantableRole; onChange: (role: GrantableRole) => void }) {
  const id = useId();
  return (
    <Menu
      label={`Role for ${name}`}
      align="start"
      menuClassName="w-72"
      buttonLabel={`Role for ${name}: ${ROLE_LABELS[role]}`}
      buttonClassName={`${menuField} w-28 md:w-36`}
      button={
        <>
          {ROLE_LABELS[role]}
          <LineIcon name="chevronDown" className="size-4 text-zinc-500 dark:text-zinc-400" />
        </>
      }
    >
      {(close) =>
        GRANTABLE_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="menuitemradio"
            aria-checked={r === role}
            aria-labelledby={`${id}-${r}`}
            aria-describedby={`${id}-${r}-hint`}
            onClick={() => {
              close();
              if (r !== role) onChange(r);
            }}
            className={menuItem}
          >
            <span className="flex flex-1 flex-col gap-0.5">
              <span id={`${id}-${r}`} className="font-medium">
                {ROLE_LABELS[r]}
              </span>
              <span id={`${id}-${r}-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
                {ROLE_HINTS[r]}
              </span>
            </span>
            {r === role && <LineIcon name="check" className="size-4 shrink-0" />}
          </button>
        ))
      }
    </Menu>
  );
}

/**
 * A member: avatar, name, email, role and when they joined. Admins and the Owner change anyone's role
 * but the Owner's (shown at once, while it saves), and remove others after a confirmation; leaving is
 * in Settings.
 */
export function MemberRow({
  member,
  groupName,
  isYou,
  changeRole,
  remove,
}: {
  member: { name: string; email: string; role: Role; joined: string };
  groupName: string;
  isYou: boolean;
  changeRole: FormAction;
  remove: ButtonAction;
}) {
  const [roleState, roleAction, changing] = useActionState(changeRole, {});
  const [shownRole, showRole] = useOptimistic(member.role);
  const [removing, setRemoving] = useState(false);

  function change(role: GrantableRole) {
    const form = new FormData();
    form.set("role", role);
    startTransition(() => {
      showRole(role);
      roleAction(form);
    });
  }

  return (
    <li className={`flex flex-col gap-3 px-4 py-3.5 sm:px-5 ${MEMBER_COLUMNS}`}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.name} className="size-9 text-xs" />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{member.name}</span>
            {isYou && <span className={`${badge} ${quietBadge}`}>You</span>}
          </p>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 md:contents">
        <div>
          {member.role === "owner" ? (
            <span className={`${badge} ${ROLE_BADGE.owner}`}>Owner</span>
          ) : (
            <RoleMenu name={member.name} role={shownRole as GrantableRole} onChange={change} />
          )}
        </div>
        <p className="text-sm whitespace-nowrap text-zinc-500 dark:text-zinc-400">
          <span className="md:sr-only">Joined </span>
          {member.joined}
        </p>
        <div className="ml-auto md:ml-0">
          {member.role !== "owner" && !isYou && (
            <Menu label={`Options for ${member.name}`} buttonLabel={`Options for ${member.name}`} buttonClassName={iconButton} menuClassName="w-56" button={<LineIcon name="more" className="size-5" />}>
              {(close) => (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    setRemoving(true);
                  }}
                  className={dangerMenuItem}
                >
                  <LineIcon name="trash" className="size-4 shrink-0" />
                  Remove from group…
                </button>
              )}
            </Menu>
          )}
        </div>
      </div>
      {(roleState.done || roleState.error) && !changing && (
        <div className="md:col-span-4">
          {roleState.done && (
            <p role="status" className="text-sm text-green-700 dark:text-green-400">
              {roleState.done}
            </p>
          )}
          <Problem state={roleState} />
        </div>
      )}
      <Dialog
        open={removing}
        onClose={() => setRemoving(false)}
        title={`Remove ${member.name}?`}
        description={`They lose access to ${groupName} straight away. To come back, they'll need a new invite.`}
      >
        <RemoveForm remove={remove} onCancel={() => setRemoving(false)} />
      </Dialog>
    </li>
  );
}

function RemoveForm({ remove, onCancel }: { remove: ButtonAction; onCancel: () => void }) {
  const [state, removeAction, pending] = useActionState(remove, {});
  return (
    <form action={removeAction} className="flex flex-col gap-5">
      <Problem state={state} />
      <DialogActions>
        <button type="button" data-autofocus onClick={onCancel} className={button("ghost")}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={button("danger")}>
          {pending ? "Removing…" : "Remove"}
        </button>
      </DialogActions>
    </form>
  );
}

/** F4: a request waiting for an answer. Approve with a role (View unless another is chosen), or Deny. */
export function RequestRow({ request, decide }: { request: { name: string; email: string; message?: string; date: string }; decide: FormAction }) {
  const [state, decideAction, pending] = useActionState(decide, {});
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex min-w-0 gap-3">
          <Avatar name={request.name} className="size-9 text-xs" />
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{request.name}</p>
            <p className="text-sm break-words text-zinc-500 dark:text-zinc-400">
              {request.email} · asked {request.date}
            </p>
            {request.message && <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300">“{request.message}”</p>}
          </div>
        </div>
        <form action={decideAction} className="flex flex-wrap items-center gap-2 md:shrink-0">
          <select name="role" aria-label={`Role for ${request.name}`} defaultValue="view" className={compactField}>
            {GRANTABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button type="submit" name="decision" value="deny" disabled={pending} className={button("ghost")}>
            Deny
          </button>
          <button type="submit" name="decision" value="approve" disabled={pending} className={button("primary")}>
            Approve
          </button>
        </form>
      </div>
      <Problem state={state} />
    </li>
  );
}
