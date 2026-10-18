import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getDatabase } from "@/server/db";
import { requireUser } from "@/server/permissions";
import { listGroupsForUser, type GroupSummary } from "@/server/repositories/groups";
import { NewGroupForm } from "./NewGroupForm";

export const metadata: Metadata = { title: "Dashboard · Family Tree" };

const ROLE_LABELS = { owner: "Owner", admin: "Admin", maintain: "Maintain", view: "View" } as const;

/** My groups, Shared with me, and creating a group (F1, F2). Invites and access requests arrive in step 8. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const groups = await listGroupsForUser((await getDatabase()).db, user.id);
  const mine = groups.filter((g) => g.role === "owner");
  const shared = groups.filter((g) => g.role !== "owner");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          {groups.length === 0 && (
            <p className="text-zinc-600 dark:text-zinc-400">
              You don&apos;t have any family groups yet. Create one below, or ask a relative to share theirs with you.
            </p>
          )}
        </div>
        <GroupList title="My groups" groups={mine} empty="You haven't created a group yet." />
        <GroupList title="Shared with me" groups={shared} empty="Nobody has shared a group with you yet." />
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Create a family group</h2>
          <NewGroupForm myName={user.name} />
        </section>
      </main>
    </>
  );
}

function GroupList({ title, groups, empty }: { title: string; groups: GroupSummary[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/g/${g.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-zinc-500">{ROLE_LABELS[g.role]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
