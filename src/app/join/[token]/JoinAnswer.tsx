"use client";

import Link from "next/link";
import { useActionState } from "react";
import { button } from "@/components/ui/button";
import { formError } from "@/components/ui/field";
import type { InviteAnswerState } from "../../invite/[token]/actions";

/** Join or Not now, on an invite link's page. Nothing happens until Join: link previews open the page too. */
export function JoinAnswer({ join, groupName }: { join: () => Promise<InviteAnswerState>; groupName: string }) {
  const [state, joinAction, joining] = useActionState(join, {});
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <form action={joinAction}>
          <button type="submit" disabled={joining} aria-label={`Join ${groupName}`} className={button("primary")}>
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
        <Link href="/dashboard" className={button("ghost")}>
          Not now
        </Link>
      </div>
      {state.error && (
        <p role="alert" className={formError}>
          {state.error}
        </p>
      )}
    </div>
  );
}
