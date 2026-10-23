import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { acceptInviteAction, declineInviteAction } from "@/app/invite/[token]/actions";
import { InviteAnswer } from "@/app/invite/[token]/InviteAnswer";
import { AppHeader } from "@/components/AppHeader";
import { REQUEST_DENIED } from "@/components/request-messages";
import { shortDate } from "@/components/short-date";
import { badge, countBadge, quietBadge, ROLE_BADGE } from "@/components/ui/badge";
import { card, cardRows } from "@/components/ui/card";
import { LineIcon } from "@/components/ui/icons";
import { pageFrame } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingPage, skeleton } from "@/components/ui/Skeleton";
import { getDatabase } from "@/server/db";
import { ROLE_LABELS } from "@/server/members-rules";
import { requireUser } from "@/server/permissions";
import { myRequests, pendingRequestCounts, type MyRequest } from "@/server/repositories/access-requests";
import { loadGroupTree } from "@/server/repositories/family";
import { listGroupsForUser, type GroupSummary } from "@/server/repositories/groups";
import { invitesForUser, type InviteForMe } from "@/server/repositories/invites";
import { memberCounts } from "@/server/repositories/members";
import { can } from "@/server/roles";
import { familyCounts } from "@/tree/everyone";
import { datedFamily } from "@/tree/upcoming";
import { ImportNewGroup } from "./ImportNewGroup";
import { NewGroupButton } from "./NewGroupForm";
import { UpcomingSoon } from "./UpcomingSoon";

export const metadata: Metadata = { title: "Dashboard · Family Tree" };

/** A group as its card shows it. */
interface GroupCard extends GroupSummary {
  people: number;
  couples: number;
  members: number;
  waiting: number;
}

/**
 * Invitations waiting for me, my groups as cards (with access requests where I'm an Admin or the
 * Owner), Shared with me, my access requests, and the birthdays and anniversaries coming up; New group
 * and Import a file open dialogs (F1–F4; the production look, part 2, an owner request).
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const { db } = await getDatabase();
  const [groups, invites, requests] = await Promise.all([listGroupsForUser(db, user.id), invitesForUser(db, user), myRequests(db, user.id)]);
  const managed = groups.filter((g) => can(g.role, "handleAccessRequests")).map((g) => g.id);
  // Upcoming (an owner request): only the groups I'm a member of (any role may view), and of each only
  // the dated people and couples; the browser works out which days come up. The same trees give the
  // cards their counts.
  const [waiting, trees, members] = await Promise.all([
    managed.length ? pendingRequestCounts(db, managed) : new Map<string, number>(),
    Promise.all(groups.map((g) => loadGroupTree(db, g.id))),
    memberCounts(db, groups.map((g) => g.id)),
  ]);
  const upcoming = groups.map((g, i) => ({ groupId: g.id, groupName: g.name, family: datedFamily(trees[i]) }));
  const cards: GroupCard[] = groups.map((g, i) => ({ ...g, ...familyCounts(trees[i]), members: members.get(g.id) ?? 1, waiting: waiting.get(g.id) ?? 0 }));
  const mine = cards.filter((g) => g.role === "owner");
  const shared = cards.filter((g) => g.role !== "owner");
  const firstVisit = groups.length === 0 && invites.length === 0;

  return (
    <div className={pageFrame}>
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          title={`Welcome, ${user.name}`}
          description="Your family groups, and the days coming up."
          actions={
            !firstVisit && (
              <>
                <ImportNewGroup />
                <NewGroupButton myName={user.name} />
              </>
            )
          }
        />

        {invites.length > 0 && <Invitations invites={invites} />}

        {firstVisit ? (
          <>
            <FirstVisit myName={user.name} />
            {requests.length > 0 && <MyRequests requests={requests} />}
          </>
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-8">
              <GroupGrid title="My groups" groups={mine}>
                <li>
                  <NewGroupButton myName={user.name} look="card" />
                </li>
              </GroupGrid>
              <GroupGrid title="Shared with me" groups={shared} empty="Nobody has shared a group with you yet." />
              {requests.length > 0 && <MyRequests requests={requests} />}
            </div>
            {groups.length > 0 && (
              <aside className="lg:sticky lg:top-6 lg:w-[22rem] lg:shrink-0">
                <UpcomingSoon groups={upcoming} />
              </aside>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** The page's shape while it loads: the heading and two cards, so nothing jumps when it arrives. */
function DashboardLoading() {
  return (
    <LoadingPage className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className={`${skeleton} h-8 w-72 max-w-full rounded-md`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:mr-[23.5rem]">
        <div className={`${skeleton} h-44 rounded-2xl`} />
        <div className={`${skeleton} h-44 rounded-2xl`} />
      </div>
    </LoadingPage>
  );
}

/** No groups and no invitations: what the app is for, and the two ways to start. */
function FirstVisit({ myName }: { myName: string }) {
  return (
    <section aria-label="Get started" className={`${card} flex flex-col items-center gap-5 px-6 py-12 text-center`}>
      <FamilyGlyph className="h-16 w-20" />
      <div className="max-w-md">
        <h2 className="text-xl font-semibold tracking-tight">Start your family tree</h2>
        <p className="mt-2 text-[15px] text-pretty text-zinc-600 dark:text-zinc-400">
          You don&apos;t have any family groups yet. Create one with your parents&apos; names, import a family file, or ask a relative to share theirs with you.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <ImportNewGroup />
        <NewGroupButton myName={myName} />
      </div>
    </section>
  );
}

function Invitations({ invites }: { invites: InviteForMe[] }) {
  return (
    <section aria-label="Invitations">
      <ul className="flex flex-col gap-3">
        {invites.map((i) => (
          <li
            key={i.token}
            className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30"
          >
            <div className="flex items-start gap-3">
              <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                <LineIcon name="mail" className="size-[18px]" />
              </span>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{i.groupName}</p>
                <p className="text-sm text-amber-900/80 dark:text-amber-200/80">
                  {i.invitedBy} invited you as {ROLE_LABELS[i.role]}. Accept to see the family tree.
                </p>
              </div>
            </div>
            <InviteAnswer accept={acceptInviteAction.bind(null, i.token)} decline={declineInviteAction.bind(null, i.token)} groupName={i.groupName} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function GroupGrid({ title, groups, empty, children }: { title: string; groups: GroupCard[]; empty?: string; children?: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {groups.length === 0 && !children ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id} className="relative">
              <Link
                href={`/g/${g.id}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500/70 motion-reduce:hover:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span aria-hidden className="relative block h-16 bg-linear-to-br from-blue-50 to-pink-50 dark:from-blue-950/50 dark:to-pink-950/40">
                  <FamilyGlyph className="absolute top-3 right-4 h-10 w-12" />
                </span>
                <span className="flex flex-1 flex-col gap-1 p-5 pb-4">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{g.name}</span>
                    <span className={`${badge} ${ROLE_BADGE[g.role]}`}>{ROLE_LABELS[g.role]}</span>
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {plural(g.people, "person", "people")} · {plural(g.couples, "couple", "couples")} · {plural(g.members, "member", "members")}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-1 border-t border-zinc-100 px-5 py-3 text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                  Open
                  <LineIcon name="arrowRight" className="size-4" />
                </span>
              </Link>
              {g.waiting > 0 && <RequestBadge groupId={g.id} count={g.waiting} />}
            </li>
          ))}
          {children}
        </ul>
      )}
    </section>
  );
}

/**
 * "2 access requests", over the card's foot, linking to the members page where they're answered. On
 * touch screens the link around the pill is 44 px high, centred on the foot like the pill.
 */
function RequestBadge({ groupId, count }: { groupId: string; count: number }) {
  return (
    <Link
      href={`/g/${groupId}/members`}
      className="group absolute bottom-2.5 left-4 inline-flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 pointer-coarse:bottom-0.5 pointer-coarse:min-h-11"
    >
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 group-hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:group-hover:bg-amber-900">
        {count} access {count === 1 ? "request" : "requests"}
      </span>
    </Link>
  );
}

/** My requests to join groups. No group names: I'm not in them, and a made-up group must look the same (§8). */
function MyRequests({ requests }: { requests: MyRequest[] }) {
  return (
    <section className="flex flex-col gap-3" aria-label="My access requests">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">My access requests</h2>
      <ul className={`${card} ${cardRows} overflow-hidden`}>
        {requests.map((r) => (
          <li key={r.groupId} className="flex flex-col gap-1.5 px-5 py-4 text-sm">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`${badge} ${r.status === "pending" ? countBadge : quietBadge}`}>
                {r.status === "pending" ? "Waiting for an admin" : "Declined"}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                asked {shortDate(r.createdAt)} ·{" "}
                <Link href={`/g/${r.groupId}`} className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">
                  the link you opened
                </Link>
              </span>
            </p>
            {r.message && <p className="text-zinc-600 dark:text-zinc-400">Your message: “{r.message}”</p>}
            {r.status === "denied" && <p className="text-zinc-500 dark:text-zinc-400">{REQUEST_DENIED}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A couple and their two children, drawn like the tree's cards (the app's icon without its tile). */
function FamilyGlyph({ className }: { className?: string }) {
  const ring = "stroke-[2.2]";
  return (
    <svg aria-hidden viewBox="0 0 48 40" className={className}>
      <path d="M24 14.5V22M11.5 22H36.5M11.5 22V27M36.5 22V27" fill="none" className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="9" r="6" className={`fill-blue-50 stroke-blue-300 dark:fill-blue-950 ${ring}`} />
      <circle cx="38" cy="9" r="6" className={`fill-pink-50 stroke-pink-300 dark:fill-pink-950 ${ring}`} />
      <path
        transform="translate(19.5 4.6) scale(0.375)"
        className="fill-rose-400"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
      <circle cx="11.5" cy="32" r="6" className={`fill-pink-50 stroke-pink-300 dark:fill-pink-950 ${ring}`} />
      <circle cx="36.5" cy="32" r="6" className={`fill-blue-50 stroke-blue-300 dark:fill-blue-950 ${ring}`} />
    </svg>
  );
}
