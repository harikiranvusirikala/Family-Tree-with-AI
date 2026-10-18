import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { UserMenu } from "@/components/auth/UserMenu";
import { requireUser } from "@/server/permissions";

export const metadata: Metadata = { title: "Dashboard · Family Tree" };

/** Placeholder until step 5 adds My groups, Shared with me, invites and access requests. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser();
  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Family Tree
        </Link>
        <UserMenu user={{ name: user.name, email: user.email }} />
      </header>
      <main className="flex flex-1 flex-col gap-3 px-6 py-10">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Your family groups will appear here.</p>
      </main>
    </>
  );
}
