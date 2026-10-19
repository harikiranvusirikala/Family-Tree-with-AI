import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getDatabase } from "@/server/db";
import { maskEmail, normalizeEmail, ROLE_LABELS } from "@/server/members-rules";
import { requireUser } from "@/server/permissions";
import { roleInGroup } from "@/server/repositories/groups";
import { inviteForToken, INVALID_INVITE } from "@/server/repositories/invites";
import { NoAccessError } from "@/server/roles";
import { acceptInviteAction, declineInviteAction } from "./actions";
import { InviteAnswer, SwitchAccountButton } from "./InviteAnswer";

export const metadata: Metadata = { title: "Invite · Family Tree" };

/** F3: an invite link. Signed-out visitors sign in first and come back here (src/proxy.ts). */
export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Opening the invite…</p>}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  const user = await requireUser();
  const { db } = await getDatabase();
  const invite = await inviteForToken(db, token);
  if (invite) {
    const member = await roleInGroup(db, invite.groupId, user.id, "view").then(
      () => true,
      (error: unknown) => {
        if (error instanceof NoAccessError) return false;
        throw error;
      },
    );
    if (member) redirect(`/g/${invite.groupId}`); // streamed: the page has already started
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center" data-testid="invite">
        {!invite ? (
          <>
            <h1 className="text-2xl font-semibold">{INVALID_INVITE}</h1>
            <p className="max-w-md text-zinc-600 dark:text-zinc-400">It may have expired or been withdrawn. Ask the person who sent it for a new one.</p>
            <Link href="/dashboard" className="text-sm font-medium underline">
              Go to your dashboard
            </Link>
          </>
        ) : normalizeEmail(invite.email) !== normalizeEmail(user.email) ? (
          // Another account: nothing about the group, only enough of the address to recognise it.
          <>
            <h1 className="text-2xl font-semibold">This invite is for another account</h1>
            <p className="max-w-md text-zinc-600 dark:text-zinc-400">
              This invite is for {maskEmail(invite.email)}. You&apos;re signed in as {user.email}.
            </p>
            <SwitchAccountButton />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Join {invite.groupName}</h1>
            <p className="max-w-md text-zinc-600 dark:text-zinc-400">
              {invite.invitedBy} invited you to join {invite.groupName} as {ROLE_LABELS[invite.role]}.
            </p>
            <InviteAnswer accept={acceptInviteAction.bind(null, token)} decline={declineInviteAction.bind(null, token)} groupName={invite.groupName} />
          </>
        )}
      </main>
    </>
  );
}
