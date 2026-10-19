import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NoAccess } from "@/components/NoAccess";
import { shortDate } from "@/components/short-date";
import { getDatabase } from "@/server/db";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
import { listRequests } from "@/server/repositories/access-requests";
import { listInvites } from "@/server/repositories/invites";
import { listMembers } from "@/server/repositories/members";
import { can } from "@/server/roles";
import { changeRoleAction, decideRequestAction, inviteAction, removeMemberAction, revokeInviteAction } from "./actions";
import { InviteForm, InviteRow, MemberRow, RequestRow } from "./MembersForms";

export const metadata: Metadata = { title: "Members · Family Tree" };

const list = "flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800";

/** F3, F4: access requests, members and invites (Admin and up). */
export default function MembersPage({ params }: PageProps<"/g/[groupId]/members">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>}>
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
  const header = (
    <AppHeader user={user}>
      <Link href={`/g/${groupId}`} className="truncate font-medium underline">
        {access.group.name}
      </Link>
    </AppHeader>
  );
  if (!can(access.role, "manageMembers")) {
    return (
      <>
        {header}
        <main className="mx-auto w-full max-w-2xl px-6 py-10 text-zinc-600 dark:text-zinc-400">Only Admins and the Owner manage members.</main>
      </>
    );
  }

  const { db } = await getDatabase();
  const [requests, members, invites] = await Promise.all([listRequests(db, groupId), listMembers(db, groupId), listInvites(db, groupId)]);

  return (
    <>
      {header}
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-10">
        <h1 className="text-2xl font-semibold">Members</h1>

        <section aria-label="Access requests" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Access requests</h2>
          {requests.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No requests waiting.</p>
          ) : (
            <ul className={list}>
              {requests.map((r) => (
                <RequestRow
                  key={r.id}
                  request={{ name: r.name, email: r.email, message: r.message, date: shortDate(r.createdAt) }}
                  decide={decideRequestAction.bind(null, groupId, r.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Members" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">People in this group</h2>
          <ul className={list}>
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                isYou={m.userId === user.id}
                changeRole={changeRoleAction.bind(null, groupId, m.userId)}
                remove={removeMemberAction.bind(null, groupId, m.userId)}
              />
            ))}
          </ul>
        </section>

        <section aria-label="Invites" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Invite someone</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            They get a link to share by WhatsApp or text. It works only for that email&apos;s Google account, for 14 days.
          </p>
          <InviteForm action={inviteAction.bind(null, groupId)} />
          {invites.length > 0 && (
            <>
              <h3 className="font-medium">Pending invites</h3>
              <ul className={list}>
                {invites.map((i) => (
                  <InviteRow
                    key={i.id}
                    invite={{ email: i.email, role: i.role, token: i.token, invitedBy: i.invitedBy, expires: shortDate(i.expiresAt) }}
                    revoke={revokeInviteAction.bind(null, groupId, i.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
    </>
  );
}
