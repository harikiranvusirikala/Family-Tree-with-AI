import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { button } from "@/components/ui/button";
import { MessagePage, MessageText } from "@/components/ui/MessagePage";
import { LoadingPage, skeleton } from "@/components/ui/Skeleton";
import { getDatabase } from "@/server/db";
import { ROLE_LABELS } from "@/server/members-rules";
import { requireUser } from "@/server/permissions";
import { roleInGroup } from "@/server/repositories/groups";
import { inviteLinkForToken } from "@/server/repositories/invite-links";
import { INVALID_INVITE } from "@/server/repositories/invites";
import { NoAccessError } from "@/server/roles";
import { joinByLinkAction } from "./actions";
import { JoinAnswer } from "./JoinAnswer";

export const metadata: Metadata = { title: "Invite · Family Tree" };

/** An invite link for anyone. Signed-out visitors sign in first and come back here (src/proxy.ts). */
export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <Suspense
      fallback={
        <LoadingPage className="flex flex-1 items-center justify-center px-4 py-12 sm:py-20">
          <div className={`${skeleton} h-72 w-full max-w-md rounded-2xl`} />
        </LoadingPage>
      }
    >
      <Join params={params} />
    </Suspense>
  );
}

async function Join({ params }: Pick<PageProps<"/join/[token]">, "params">) {
  const { token } = await params;
  const user = await requireUser();
  const { db } = await getDatabase();
  const link = await inviteLinkForToken(db, token);
  if (link) {
    const member = await roleInGroup(db, link.groupId, user.id, "view").then(
      () => true,
      (error: unknown) => {
        if (error instanceof NoAccessError) return false;
        throw error;
      },
    );
    if (member) redirect(`/g/${link.groupId}`); // streamed: the page has already started
  }

  return (
    <>
      <AppHeader user={user} />
      {!link ? (
        <MessagePage icon="alert" title={INVALID_INVITE} testId="invite">
          <MessageText>It may have expired, been withdrawn or reached its limit. Ask the person who sent it for a new one.</MessageText>
          <Link href="/dashboard" className={button("secondary")}>
            Go to your dashboard
          </Link>
        </MessagePage>
      ) : (
        <MessagePage icon="mail" title={`Join ${link.groupName}`} testId="invite">
          <MessageText>
            {link.invitedBy} invited you to join {link.groupName} as {ROLE_LABELS[link.role]}.
          </MessageText>
          <JoinAnswer join={joinByLinkAction.bind(null, token)} groupName={link.groupName} />
        </MessagePage>
      )}
    </>
  );
}
