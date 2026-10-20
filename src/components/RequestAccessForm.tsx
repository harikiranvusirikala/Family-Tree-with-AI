"use client";

import { useActionState } from "react";
import type { RequestAccessState } from "@/app/g/[groupId]/actions";
import { REQUEST_DENIED, REQUEST_SENT } from "./request-messages";

type Action = (previous: RequestAccessState, formData: FormData) => Promise<RequestAccessState>;

/** F4: Request access, with an optional message for the group's admins. */
export function RequestAccessForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.outcome === "sent") return <p role="status" className="max-w-md text-zinc-600 dark:text-zinc-400">{REQUEST_SENT}</p>;
  if (state.outcome === "declined") return <p className="max-w-md text-zinc-600 dark:text-zinc-400">{REQUEST_DENIED}</p>;
  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Message for the admins (optional)
        <textarea
          name="message"
          maxLength={500}
          rows={3}
          placeholder="e.g. I'm Ravi's niece"
          className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
      <div className="text-center">
        <button type="submit" disabled={pending} className="rounded-full bg-zinc-900 px-5 py-2 pointer-coarse:min-h-11 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900">
          {pending ? "Sending…" : "Request access"}
        </button>
      </div>
    </form>
  );
}
