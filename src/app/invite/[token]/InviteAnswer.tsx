"use client";

import { useActionState, useState } from "react";
import { authClient } from "@/components/auth/auth-client";
import { button } from "@/components/ui/button";
import { useHydrated } from "@/components/use-hydrated";
import type { InviteAnswerState } from "./actions";

type Answer = () => Promise<InviteAnswerState>;

/** Accept or Decline an invite: on its page, and on the dashboard. */
export function InviteAnswer({ accept, decline, groupName }: { accept: Answer; decline: Answer; groupName: string }) {
  const [acceptState, acceptAction, accepting] = useActionState(accept, {});
  const [, declineAction, declining] = useActionState(decline, {});
  const busy = accepting || declining;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <form action={acceptAction}>
          <button
            type="submit"
            disabled={busy}
            aria-label={`Accept the invite to ${groupName}`}
            className={button("primary")}
          >
            {accepting ? "Joining…" : "Accept"}
          </button>
        </form>
        <form action={declineAction}>
          <button type="submit" disabled={busy} aria-label={`Decline the invite to ${groupName}`} className={button("ghost")}>
            Decline
          </button>
        </form>
      </div>
      {acceptState.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{acceptState.error}</p>}
    </div>
  );
}

/** Signs out and back to sign-in, returning to this invite with another Google account. */
export function SwitchAccountButton() {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  async function switchAccount() {
    setBusy(true);
    await authClient.signOut();
    window.location.replace(`/?returnTo=${encodeURIComponent(window.location.pathname)}`);
  }
  return (
    <button type="button" onClick={switchAccount} disabled={!hydrated || busy} className={button("primary")}>
      {busy ? "Signing out…" : "Sign in with another account"}
    </button>
  );
}
