import Link from "next/link";
import { requestAccessAction } from "@/app/g/[groupId]/actions";
import { getDatabase } from "@/server/db";
import { accessState } from "@/server/repositories/access-requests";
import { RequestAccessForm } from "./RequestAccessForm";
import { REQUEST_DENIED, REQUEST_SENT } from "./request-messages";

/**
 * Shown for a group the user can't open (F4). It says nothing about the group, and looks the same
 * whether or not the group exists (§8): Request access, or how their request stands. Someone invited
 * to the group gets a link to their invite instead.
 */
export async function NoAccess({ groupId, user }: { groupId: string; user: { id: string; email: string } }) {
  const state = await accessState((await getDatabase()).db, groupId, user);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center" data-testid="no-access">
      <h1 className="text-2xl font-semibold">You don&apos;t have access to this family tree</h1>
      {state.inviteToken ? (
        <>
          <p className="max-w-md text-zinc-600 dark:text-zinc-400">You&apos;ve been invited to this family tree.</p>
          <Link href={`/invite/${state.inviteToken}`} className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
            See the invite
          </Link>
        </>
      ) : state.request === "pending" ? (
        <p role="status" className="max-w-md text-zinc-600 dark:text-zinc-400">{REQUEST_SENT}</p>
      ) : state.request === "denied" ? (
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">{REQUEST_DENIED}</p>
      ) : (
        <>
          <p className="max-w-md text-zinc-600 dark:text-zinc-400">
            The link may be wrong, or nobody has shared this tree with you yet. You can ask its admins for access.
          </p>
          <RequestAccessForm action={requestAccessAction.bind(null, groupId)} />
        </>
      )}
      <Link href="/dashboard" className="text-sm font-medium underline">
        Go to your dashboard
      </Link>
    </main>
  );
}
