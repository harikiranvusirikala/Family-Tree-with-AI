"use client";

import { useActionState } from "react";
import type { RequestAccessState } from "@/app/g/[groupId]/actions";
import { REQUEST_DENIED, REQUEST_SENT } from "./request-messages";
import { button } from "./ui/button";
import { MessageText } from "./ui/MessagePage";

type Action = (previous: RequestAccessState, formData: FormData) => Promise<RequestAccessState>;

/** F4: Request access, with an optional message for the group's admins. */
export function RequestAccessForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.outcome === "sent") return <MessageText role="status">{REQUEST_SENT}</MessageText>;
  if (state.outcome === "declined") return <MessageText>{REQUEST_DENIED}</MessageText>;
  return (
    <form action={formAction} className="flex w-full flex-col gap-3 text-left">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Message for the admins (optional)
        <textarea
          name="message"
          maxLength={500}
          rows={3}
          placeholder="e.g. I'm Ravi's niece"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${button("primary")} w-full`}>
        {pending ? "Sending…" : "Request access"}
      </button>
    </form>
  );
}
