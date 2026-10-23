"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useToday } from "@/components/today";
import { PersonPhoto } from "@/components/tree/PersonPhoto";
import { card } from "@/components/ui/card";
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
 * The dashboard's Coming up (birthdays and anniversaries, an owner request; a card since the production
 * look): the next 30 days across the person's groups, nearest first, each row opening its group's
 * Upcoming view. Rows of placeholders until the device's day is known (so the page doesn't jump), and a
 * sentence when nothing is coming up.
 */
export function UpcomingSoon({ groups }: { groups: UpcomingGroup[] }) {
  const today = useToday();
  const rows = useMemo(() => {
    if (!today) return [];
    const all = groups.flatMap((group) => upcomingDates(group.family, today, 30).events.map((event) => ({ event, group })));
    return all.sort((a, b) => a.event.inDays - b.event.inDays); // stable: each group's own order within a day
  }, [groups, today]);

  return (
    <section aria-label="Coming up" className={`${card} overflow-hidden`}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Coming up</h2>
        <span className={`text-xs ${muted}`}>Next 30 days</span>
      </div>
      {!today ? (
        <ul aria-hidden className="flex flex-col gap-4 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex animate-pulse items-center gap-3 motion-reduce:animate-none">
              <span className="size-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <span className="h-3.5 flex-1 rounded bg-zinc-200 dark:bg-zinc-800" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className={`border-t border-zinc-100 px-5 py-4 text-sm text-pretty dark:border-zinc-800 ${muted}`}>
          Nothing in the next 30 days. Birthdays show for people with a full birth date, anniversaries for couples with a wedding date.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map(({ event, group }) => (
            <li key={`${group.groupId}-${event.kind}-${event.kind === "birthday" ? event.person.id : event.union.id}`}>
              <Link
                href={everyoneHref(group.groupId, "upcoming", event.kind === "birthday" ? event.person.id : undefined)}
                className="flex items-center gap-3 px-5 py-3 transition-colors outline-none hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60"
              >
                {event.kind === "birthday" ? (
                  <PersonPhoto person={event.person} size={36} thin />
                ) : (
                  <span className="flex shrink-0">
                    <PersonPhoto person={event.partners[0]} size={30} thin />
                    <span className="-ml-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900">
                      <PersonPhoto person={event.partners[1]} size={30} thin />
                    </span>
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{what(event)}</span>
                  <span className={`block truncate text-xs ${muted}`}>
                    {group.groupName}
                    {event.inDays > 1 && ` · ${formatInDays(event.inDays).toLowerCase()}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      event.inDays === 0 ? "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {event.inDays <= 1 ? formatInDays(event.inDays) : formatDay(event.date)}
                  </span>
                  {event.milestone && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{event.milestone}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "Steve Cruz turns 41", "Steve Cruz & Arham Chopra: 19th anniversary". */
const what = (e: Upcoming) => (e.kind === "birthday" ? `${e.person.name} turns ${e.age}` : `${e.partners[0].name} & ${e.partners[1].name}: ${ordinal(e.years)} anniversary`);
