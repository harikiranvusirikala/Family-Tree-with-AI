import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { GroupHeader } from "@/components/GroupHeader";
import { googlePhotoUrl } from "@/components/google-photo";
import { NoAccess } from "@/components/NoAccess";
import { shortDate } from "@/components/short-date";
import { badge, countBadge } from "@/components/ui/badge";
import { button } from "@/components/ui/button";
import { card, cardHeader, cardRows, cardText, cardTitle } from "@/components/ui/card";
import { MessagePage, MessageText } from "@/components/ui/MessagePage";
import { pageFrame } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingPage, skeleton } from "@/components/ui/Skeleton";
import { getDatabase } from "@/server/db";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
import { listRequests } from "@/server/repositories/access-requests";
import { listInviteLinks } from "@/server/repositories/invite-links";
import { listInvites } from "@/server/repositories/invites";
import { listMembers } from "@/server/repositories/members";
import { can } from "@/server/roles";
import { changeRoleAction, createInviteLinkAction, decideRequestAction, inviteAction, removeMemberAction, revokeInviteAction, revokeInviteLinkAction } from "./actions";
import { MEMBER_COLUMNS } from "./columns";
import { CreateLinkButton, InviteButton, InviteRow, LinkRow, MemberRow, RequestRow } from "./MembersForms";

export const metadata: Metadata = { title: "Members · Family Tree" };

const columnLabel = "hidden text-xs font-medium tracking-wide text-zinc-500 uppercase md:block dark:text-zinc-400";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** F3, F4: access requests, members, invite links and invites (Admin and up), as cards; Invite people opens a dialog. */
export default function MembersPage({ params }: PageProps<"/g/[groupId]/members">) {
  return (
    <Suspense fallback={<MembersLoading />}>
      <GroupMembers params={params} />
    </Suspense>
  );
}

async function GroupMembers({ params }: Pick<PageProps<"/g/[groupId]/members">, "params">) {
  const { groupId } = await params;
  const user = await requireUser();
  const access = await requireRole(groupId, "view").catch(noAccessToNull);
  if (!access) {
    return (
      <>
        <AppHeader user={user} />
        <NoAccess groupId={groupId} user={user} />
      </>
    );
  }
  const header = <GroupHeader user={user} groupId={groupId} groupName={access.group.name} role={access.role} active="members" />;
  if (!can(access.role, "manageMembers")) {
    return (
      <div className={pageFrame}>
        {header}
        <MessagePage icon="people" title="Only Admins and the Owner manage members.">
          <MessageText>To invite someone or answer an access request, ask one of them.</MessageText>
          <Link href={`/g/${groupId}`} className={button("secondary")}>
            Back to the tree
          </Link>
        </MessagePage>
      </div>
    );
  }

  const { db } = await getDatabase();
  const [requests, members, links, invites] = await Promise.all([
    listRequests(db, groupId),
    listMembers(db, groupId),
    listInviteLinks(db, groupId),
    listInvites(db, groupId),
  ]);
  const groupName = access.group.name;

  return (
    <div className={pageFrame}>
      {header}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          title="Members"
          description={`${plural(members.length, "person", "people")} can see ${groupName}. Only Admins and the Owner let people in.`}
          actions={<InviteButton action={inviteAction.bind(null, groupId)} />}
        />

        <section aria-label="Access requests" className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Access requests</h2>
            {requests.length > 0 && <span className={`${badge} ${countBadge}`}>{requests.length}</span>}
          </div>
          {requests.length === 0 ? (
            <p className={`${cardText} px-4 py-4 sm:px-5`}>No requests waiting.</p>
          ) : (
            <ul className={cardRows}>
              {requests.map((r) => (
                <RequestRow
                  key={r.id}
                  request={{ name: r.name, email: r.email, photo: googlePhotoUrl(r.image), message: r.message, date: shortDate(r.createdAt) }}
                  decide={decideRequestAction.bind(null, groupId, r.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="People" className={card}>
          <div className={`${cardHeader} ${MEMBER_COLUMNS}`}>
            <h2 className={cardTitle}>People</h2>
            <span aria-hidden className={columnLabel}>
              Role
            </span>
            <span aria-hidden className={columnLabel}>
              Joined
            </span>
          </div>
          <ul className={cardRows}>
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                member={{ name: m.name, email: m.email, photo: googlePhotoUrl(m.image), role: m.role, joined: shortDate(m.joinedAt), byLink: m.byLink }}
                groupName={groupName}
                isYou={m.userId === user.id}
                changeRole={changeRoleAction.bind(null, groupId, m.userId)}
                remove={removeMemberAction.bind(null, groupId, m.userId)}
              />
            ))}
          </ul>
        </section>

        <section aria-label="Invite links" className={card}>
          <div className={cardHeader}>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className={cardTitle}>Invite links</h2>
              <p className={cardText}>One link for the whole family: anyone who opens it can join. Revoke a link to keep someone out.</p>
            </div>
            <CreateLinkButton action={createInviteLinkAction.bind(null, groupId)} />
          </div>
          {links.length === 0 ? (
            <p className={`${cardText} px-4 py-4 sm:px-5`}>No links. Create one to share in a family group chat.</p>
          ) : (
            <ul className={cardRows}>
              {links.map((l) => (
                <LinkRow
                  key={l.id}
                  link={{ role: l.role, token: l.token, createdBy: l.createdBy, expires: shortDate(l.expiresAt), uses: l.uses, maxUses: l.maxUses, joined: l.joined }}
                  revoke={revokeInviteLinkAction.bind(null, groupId, l.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Invites waiting" className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Invites waiting</h2>
            <p className={cardText}>Each link works only for its email&apos;s Google account, for 14 days.</p>
          </div>
          {invites.length === 0 ? (
            <p className={`${cardText} px-4 py-4 sm:px-5`}>No invites waiting.</p>
          ) : (
            <ul className={cardRows}>
              {invites.map((i) => (
                <InviteRow
                  key={i.id}
                  invite={{ email: i.email, role: i.role, token: i.token, invitedBy: i.invitedBy, expires: shortDate(i.expiresAt) }}
                  revoke={revokeInviteAction.bind(null, groupId, i.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

/** The page's shape while it loads: the heading, Invite people and two cards. */
function MembersLoading() {
  return (
    <LoadingPage className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className={`${skeleton} h-8 w-40 rounded-md`} />
          <div className={`${skeleton} h-4 w-72 max-w-full rounded-md`} />
        </div>
        <div className={`${skeleton} hidden h-9 w-36 rounded-lg sm:block`} />
      </div>
      <div className={`${skeleton} h-24 rounded-2xl`} />
      <div className={`${skeleton} h-72 rounded-2xl`} />
    </LoadingPage>
  );
}
