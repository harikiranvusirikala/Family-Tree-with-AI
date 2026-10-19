import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { acceptInviteAction, declineInviteAction } from "@/app/invite/[token]/actions";
import { InviteAnswer } from "@/app/invite/[token]/InviteAnswer";
import { AppHeader } from "@/components/AppHeader";
import { REQUEST_DENIED } from "@/components/request-messages";
import { shortDate } from "@/components/short-date";
import { getDatabase } from "@/server/db";
import { ROLE_LABELS } from "@/server/members-rules";
import { requireUser } from "@/server/permissions";
import { myRequests, pendingRequestCounts, type MyRequest } from "@/server/repositories/access-requests";
import { listGroupsForUser, type GroupSummary } from "@/server/repositories/groups";
import { invitesForUser, type InviteForMe } from "@/server/repositories/invites";
import { can } from "@/server/roles";
import { NewGroupForm } from "./NewGroupForm";

export const metadata: Metadata = { title: "Dashboard · Family Tree" };

const list = "flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800";

/**
 * Invitations waiting for me, My groups, Shared with me (with a badge for access requests where I'm
 * an Admin or the Owner), my access requests, and creating a group (F1–F4).
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const { db } = await getDatabase();
  const [groups, invites, requests] = await Promise.all([listGroupsForUser(db, user.id), invitesForUser(db, user), myRequests(db, user.id)]);
  const managed = groups.filter((g) => can(g.role, "handleAccessRequests")).map((g) => g.id);
  const waiting = managed.length ? await pendingRequestCounts(db, managed) : new Map<string, number>();
  const mine = groups.filter((g) => g.role === "owner");
  const shared = groups.filter((g) => g.role !== "owner");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          {groups.length === 0 && invites.length === 0 && (
            <p className="text-zinc-600 dark:text-zinc-400">
              You don&apos;t have any family groups yet. Create one below, or ask a relative to share theirs with you.
            </p>
          )}
        </div>
        {invites.length > 0 && <Invitations invites={invites} />}
        <GroupList title="My groups" groups={mine} waiting={waiting} empty="You haven't created a group yet." />
        <GroupList title="Shared with me" groups={shared} waiting={waiting} empty="Nobody has shared a group with you yet." />
        {requests.length > 0 && <MyRequests requests={requests} />}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Create a family group</h2>
          <NewGroupForm myName={user.name} />
        </section>
      </main>
    </>
  );
}

function Invitations({ invites }: { invites: InviteForMe[] }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Invitations">
      <h2 className="text-lg font-semibold">Invitations</h2>
      <ul className={list}>
        {invites.map((i) => (
          <li key={i.token} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{i.groupName}</p>
              <p className="text-xs text-zinc-500">
                {i.invitedBy} invited you as {ROLE_LABELS[i.role]}
              </p>
            </div>
            <InviteAnswer accept={acceptInviteAction.bind(null, i.token)} decline={declineInviteAction.bind(null, i.token)} groupName={i.groupName} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** My requests to join groups. No group names: I'm not in them, and a made-up group must look the same (§8). */
function MyRequests({ requests }: { requests: MyRequest[] }) {
  return (
    <section className="flex flex-col gap-3" aria-label="My access requests">
      <h2 className="text-lg font-semibold">My access requests</h2>
      <ul className={list}>
        {requests.map((r) => (
          <li key={r.groupId} className="flex flex-col gap-1 px-4 py-3 text-sm">
            <p>
              <span className="font-medium">{r.status === "pending" ? "Waiting for an admin" : "Declined"}</span>
              <span className="text-zinc-500"> · asked {shortDate(r.createdAt)} · </span>
              <Link href={`/g/${r.groupId}`} className="underline">
                the link you opened
              </Link>
            </p>
            {r.message && <p className="text-zinc-600 dark:text-zinc-400">Your message: “{r.message}”</p>}
            {r.status === "denied" && <p className="text-zinc-500">{REQUEST_DENIED}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GroupList({ title, groups, waiting, empty }: { title: string; groups: GroupSummary[]; waiting: Map<string, number>; empty: string }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className={list}>
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-3 pr-4 text-xs">
              <Link href={`/g/${g.id}`} className="flex flex-1 items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <span className="text-base font-medium">{g.name}</span>
                <span className="text-zinc-500">{ROLE_LABELS[g.role]}</span>
              </Link>
              {waiting.get(g.id) ? <RequestBadge groupId={g.id} count={waiting.get(g.id)!} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "2 access requests", linking to the members page where they're answered. */
function RequestBadge({ groupId, count }: { groupId: string; count: number }) {
  return (
    <Link href={`/g/${groupId}/members`} className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
      {count} access {count === 1 ? "request" : "requests"}
    </Link>
  );
}
