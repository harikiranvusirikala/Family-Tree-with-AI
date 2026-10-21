"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useToday } from "@/components/today";
import { everyoneHref } from "@/tree/everyone";
import type { FamilyData } from "@/tree/types";
import { formatDay, formatInDays, ordinal, upcomingDates, type Upcoming } from "@/tree/upcoming";

const muted = "text-zinc-500 dark:text-zinc-400";

/** One group's dated people and couples (`datedFamily`), as the dashboard sends them. */
export interface UpcomingGroup {
  groupId: string;
  groupName: string;
  family: FamilyData;
}

/**
 * The dashboard's Upcoming (birthdays and anniversaries, an owner request): the next 30 days across
 * the person's groups, nearest first, each row opening its group's Upcoming view. Nothing until the
 * device's day is known, and nothing when no day is coming up.
 */
export function UpcomingSoon({ groups }: { groups: UpcomingGroup[] }) {
  const today = useToday();
  const rows = useMemo(() => {
    if (!today) return [];
    const all = groups.flatMap((group) => upcomingDates(group.family, today, 30).events.map((event) => ({ event, group })));
    return all.sort((a, b) => a.event.inDays - b.event.inDays); // stable: each group's own order within a day
  }, [groups, today]);
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label="Upcoming">
      <div>
        <h2 className="text-lg font-semibold">Upcoming</h2>
        <p className={`text-sm ${muted}`}>Birthdays and wedding anniversaries in the next 30 days.</p>
      </div>
      <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {rows.map(({ event, group }) => (
          <li key={`${group.groupId}-${event.kind}-${event.kind === "birthday" ? event.person.id : event.union.id}`}>
            <Link
              href={everyoneHref(group.groupId, "upcoming", event.kind === "birthday" ? event.person.id : undefined)}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="w-24 shrink-0">
                <span className="block font-medium">{formatDay(event.date)}</span>
                <span className={`block text-xs ${event.inDays === 0 ? "font-semibold text-amber-700 dark:text-amber-400" : muted}`}>{formatInDays(event.inDays)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{what(event)}</span>
                <span className={`block text-xs ${muted}`}>{group.groupName}</span>
              </span>
              {event.milestone && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{event.milestone}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Steve Cruz turns 41", "Steve Cruz & Arham Chopra: 19th anniversary". */
const what = (e: Upcoming) => (e.kind === "birthday" ? `${e.person.name} turns ${e.age}` : `${e.partners[0].name} & ${e.partners[1].name}: ${ordinal(e.years)} anniversary`);
