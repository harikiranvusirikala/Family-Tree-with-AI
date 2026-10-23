import Link from "next/link";
import { requestAccessAction } from "@/app/g/[groupId]/actions";
import { getDatabase } from "@/server/db";
import { accessState } from "@/server/repositories/access-requests";
import { RequestAccessForm } from "./RequestAccessForm";
import { REQUEST_DENIED, REQUEST_SENT } from "./request-messages";
import { button } from "./ui/button";
import { MessagePage, MessageText } from "./ui/MessagePage";

/**
 * Shown for a group the user can't open (F4). It says nothing about the group, and looks the same
 * whether or not the group exists (§8): Request access, or how their request stands. Someone invited
 * to the group gets a link to their invite instead.
 */
export async function NoAccess({ groupId, user }: { groupId: string; user: { id: string; email: string } }) {
  const state = await accessState((await getDatabase()).db, groupId, user);
  return (
    <MessagePage icon="lock" title="You don't have access to this family tree" testId="no-access">
      {state.inviteToken ? (
        <>
          <MessageText>You&apos;ve been invited to this family tree.</MessageText>
          <Link href={`/invite/${state.inviteToken}`} className={button("primary")}>
            See the invite
          </Link>
        </>
      ) : state.request === "pending" ? (
        <MessageText role="status">{REQUEST_SENT}</MessageText>
      ) : state.request === "denied" ? (
        <MessageText>{REQUEST_DENIED}</MessageText>
      ) : (
        <>
          <MessageText>The link may be wrong, or nobody has shared this tree with you yet. You can ask its admins for access.</MessageText>
          <RequestAccessForm action={requestAccessAction.bind(null, groupId)} />
        </>
      )}
      <Link href="/dashboard" className={`${button("ghost", "sm")} mt-1`}>
        Go to your dashboard
      </Link>
    </MessagePage>
  );
}
