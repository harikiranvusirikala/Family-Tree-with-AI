import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { shortDate } from "@/components/short-date";
import { card, cardHeader, cardText, cardTitle } from "@/components/ui/card";
import { pageFrame } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingPage, skeleton } from "@/components/ui/Skeleton";
import { chatConfig } from "@/server/ai/config";
import { getDatabase } from "@/server/db";
import { requireSiteAdmin } from "@/server/permissions";
import { siteStats, type Recent, type SiteStats } from "@/server/site-stats";

export const metadata: Metadata = { title: "Site stats · Family Tree" };

/**
 * How the site is used, for its owners only (an owner request, 2026-10-25): counts from the database,
 * never names, emails or family content. Anyone else gets "This page isn't here" (requireSiteAdmin).
 */
export default function AdminPage() {
  return (
    <Suspense fallback={<StatsLoading />}>
      <Stats />
    </Suspense>
  );
}

async function Stats() {
  const user = await requireSiteAdmin();
  const { db } = await getDatabase();
  const stats = await siteStats(db, { chatLimit: chatConfig()?.dailyLimit ?? 50 });
  const { totals, active, building, chat, sharing } = stats;

  return (
    <div className={pageFrame}>
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader title="Site stats" description="How people use the site. Counts only: no names, emails or family details." />

        <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Tile label="Users" value={totals.users} />
          <Tile label="Groups" value={totals.groups} />
          <Tile label="People" value={totals.people} />
          <Tile label="Couples" value={totals.couples} />
          <Tile label="Sheets" value={totals.sheets} />
          <Tile label="Photos" value={totals.photos} note={`from ${totals.photoFiles} ${totals.photoFiles === 1 ? "upload" : "uploads"}`} />
          <Tile label="Memberships" value={totals.memberships} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Active people" text="Used the site or signed in. Close counts: sessions last 30 days.">
            <dl className="grid grid-cols-3 gap-3">
              <Figure label="Last day" value={active.day} />
              <Figure label="Last 7 days" value={active.week} />
              <Figure label="Last 30 days" value={active.month} />
            </dl>
          </Card>
          <Card title="Building" text="Changes to the family trees.">
            <RecentTable
              rows={[
                ["People added", building.peopleAdded],
                ["People changed", building.peopleChanged],
                ["Groups changed", building.groupsChanged],
              ]}
            />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="New users per week" text="The last 12 weeks, Monday to Sunday (UTC).">
            <Bars label="New users per week" bars={stats.growth.users.map((w) => ({ key: w.week, label: `Week of ${shortDate(new Date(w.week))}`, value: w.count }))} />
          </Card>
          <Card title="New groups per week" text="The last 12 weeks, Monday to Sunday (UTC).">
            <Bars label="New groups per week" bars={stats.growth.groups.map((w) => ({ key: w.week, label: `Week of ${shortDate(new Date(w.week))}`, value: w.count }))} />
          </Card>
        </div>

        <Card
          title="Assistant"
          text={`Messages per day, the last 30 days (UTC). ${chat.people} ${chat.people === 1 ? "person" : "people"} used it; the daily limit was reached ${chat.daysAtLimit} ${chat.daysAtLimit === 1 ? "time" : "times"}.`}
        >
          <Bars label="Assistant messages per day" bars={chat.days.map((d) => ({ key: d.day, label: shortDate(new Date(d.day)), value: d.messages }))} />
        </Card>

        <Card title="Sharing" text="Since the start, in groups that still exist.">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Invites accepted" value={sharing.invites.accepted} />
            <Figure label="Invites waiting" value={sharing.invites.pending} />
            <Figure label="Invites declined or revoked" value={sharing.invites.declined + sharing.invites.revoked} />
            <Figure label="Invite links made" value={sharing.links} />
            <Figure label="Joins by link" value={sharing.linkJoins} />
            <Figure label="Requests approved" value={sharing.requests.approved} />
            <Figure label="Requests waiting" value={sharing.requests.pending} />
            <Figure label="Requests denied" value={sharing.requests.denied} />
          </dl>
        </Card>

        <GroupsTable groups={stats.groups} />
      </main>
    </div>
  );
}

function Card({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={card}>
      <div className={cardHeader}>
        <h2 className={cardTitle}>{title}</h2>
        <p className={`${cardText} w-full`}>{text}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className={`${card} px-4 py-3`}>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-100" data-testid={`total-${label.toLowerCase()}`}>
        {value.toLocaleString("en-GB")}
      </p>
      {note && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400" data-testid={`total-${label.toLowerCase()}-note`}>
          {note}
        </p>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[13px] text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{value.toLocaleString("en-GB")}</dd>
    </div>
  );
}

function RecentTable({ rows }: { rows: [string, Recent][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[13px] text-zinc-500 dark:text-zinc-400">
          <th className="pb-2 font-medium" />
          <th className="pb-2 text-right font-medium">Last 7 days</th>
          <th className="pb-2 text-right font-medium">Last 30 days</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map(([label, counts]) => (
          <tr key={label}>
            <th scope="row" className="py-2 text-left font-normal text-zinc-700 dark:text-zinc-300">
              {label}
            </th>
            <td className="py-2 text-right font-semibold tabular-nums">{counts.week}</td>
            <td className="py-2 text-right font-semibold tabular-nums">{counts.month}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A row of bars, the latest on the right; each bar's label and count are its tooltip and screen readers' text. */
function Bars({ label, bars }: { label: string; bars: { key: string; label: string; value: number }[] }) {
  const most = Math.max(0, ...bars.map((b) => b.value));
  const highest = Math.max(1, most);
  return (
    <div>
      <ol aria-label={label} className="flex h-28 items-end gap-1">
        {bars.map((bar) => (
          <li key={bar.key} title={`${bar.label}: ${bar.value}`} className="flex h-full flex-1 flex-col justify-end">
            <span className="sr-only">
              {bar.label}: {bar.value}
            </span>
            <span
              aria-hidden
              className={`block w-full rounded-t-sm ${bar.value ? "bg-blue-500 dark:bg-blue-400" : "bg-zinc-200 dark:bg-zinc-800"}`}
              style={{ height: bar.value ? `${Math.max(4, (bar.value / highest) * 100)}%` : "2px" }}
            />
          </li>
        ))}
      </ol>
      <div aria-hidden className="mt-1.5 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{bars[0]?.label}</span>
        <span>Most: {most}</span>
        <span>{bars.at(-1)?.label}</span>
      </div>
    </div>
  );
}

function GroupsTable({ groups }: { groups: SiteStats["groups"] }) {
  return (
    <section aria-label="Groups" className={card}>
      <div className={cardHeader}>
        <h2 className={cardTitle}>Groups</h2>
        <p className={`${cardText} w-full`}>Each group by the end of its id, most recently changed first.</p>
      </div>
      {groups.length === 0 ? (
        <p className={`${cardText} p-5`}>No groups yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[13px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-2 font-medium sm:px-5">Group</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 text-right font-medium">Members</th>
                <th className="px-3 py-2 text-right font-medium">People</th>
                <th className="px-3 py-2 text-right font-medium">Sheets</th>
                <th className="px-4 py-2 font-medium sm:px-5">Last change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {groups.map((g, i) => (
                <tr key={i} data-testid="group-row">
                  <td className="px-4 py-2 font-mono text-[13px] sm:px-5">…{g.shortId}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{shortDate(g.createdAt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.members}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.people}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.sheets}</td>
                  <td className="px-4 py-2 text-zinc-600 sm:px-5 dark:text-zinc-400">{shortDate(g.lastChange)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatsLoading() {
  return (
    <LoadingPage className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className={`${skeleton} h-8 w-56 max-w-full rounded-md`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={`${skeleton} h-20 rounded-2xl`} />
        ))}
      </div>
      <div className={`${skeleton} h-56 rounded-2xl`} />
    </LoadingPage>
  );
}
