"use client";

import { useEffect, useMemo, useRef } from "react";
import type { FamilyData } from "@/tree/types";
import { formatDay, formatInDays, formatMonth, ordinal, upcomingDates, type Day, type Upcoming } from "@/tree/upcoming";
import { formatYears } from "@/tree/years";
import { PersonPhoto } from "./PersonPhoto";

const muted = "text-zinc-500 dark:text-zinc-400";

/**
 * ★ Everyone's Upcoming view (birthdays and anniversaries, an owner request): everyone's next birthday
 * and every couple's next wedding anniversary over the next 12 months, nearest first, by month. A row
 * chooses the person, or the couple. Milestones get a badge.
 */
export function UpcomingList({
  family,
  today,
  selectedId,
  onPerson,
  onCouple,
}: {
  family: FamilyData;
  today: Day;
  selectedId?: string;
  onPerson: (personId: string) => void;
  onCouple: (unionId: string) => void;
}) {
  const { events, withoutDate } = useMemo(() => upcomingDates(family, today), [family, today]);
  const months = useMemo(() => {
    const groups: { title: string; events: Upcoming[] }[] = [];
    for (const event of events) {
      const title = formatMonth(event.date);
      if (groups.at(-1)?.title === title) groups.at(-1)!.events.push(event);
      else groups.push({ title, events: [event] });
    }
    return groups;
  }, [events]);
  const scroller = useRef<HTMLDivElement>(null);

  // Someone chosen elsewhere (Find someone, the panel): bring their row into view.
  useEffect(() => {
    if (!selectedId) return;
    scroller.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  return (
    <div ref={scroller} className="absolute inset-0 overflow-y-auto">
      {events.length === 0 ? (
        <p className={`p-4 text-sm ${muted}`}>
          No birthdays or anniversaries to show yet. Add a birthday (the day and month, the year if known) in someone&apos;s panel, or a marriage date from a couple&apos;s heart.
        </p>
      ) : (
        months.map((month) => (
          <section key={month.title} aria-label={month.title}>
            <h3 className={`sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-3 py-2 text-xs font-semibold uppercase tracking-wide md:px-4 dark:border-zinc-800 dark:bg-zinc-900/95 ${muted}`}>
              {month.title}
            </h3>
            <ul>
              {month.events.map((event) => (
                <Row
                  key={`${event.kind}-${event.kind === "birthday" ? event.person.id : event.union.id}`}
                  event={event}
                  selectedId={selectedId}
                  onPerson={onPerson}
                  onCouple={onCouple}
                />
              ))}
            </ul>
          </section>
        ))
      )}
      {withoutDate > 0 && (
        <p className={`px-3 py-4 text-xs md:px-4 ${muted}`}>
          {withoutDate} living {withoutDate === 1 ? "person has" : "people have"} no birthday (day and month) saved, so {withoutDate === 1 ? "their birthday isn't" : "their birthdays aren't"} shown.
        </p>
      )}
      {/* Room to scroll the last rows above a phone's panel, or clear of the round Ask AI button. */}
      <div aria-hidden className={selectedId ? "h-[55dvh] md:h-24 lg:h-0" : "h-24 lg:h-0"} />
    </div>
  );
}

function Row({ event, selectedId, onPerson, onCouple }: { event: Upcoming; selectedId?: string; onPerson: (id: string) => void; onCouple: (id: string) => void }) {
  const birthday = event.kind === "birthday";
  const id = birthday ? event.person.id : event.union.id;
  const selected = id === selectedId;
  // Named like the person's card, or the couple's heart.
  const label = birthday ? `${event.person.name}, ${formatYears(event.person.birthYear, event.person.deathYear)}` : `${event.partners[0].name} and ${event.partners[1].name}, married`;
  return (
    // The whole row chooses; the name is its button for keyboards and screen readers (its click reaches
    // the row). The scroll margins keep a chosen row clear of the month's heading and a phone's panel.
    <li
      data-testid="upcoming-row"
      data-id={id}
      aria-current={selected || undefined}
      onClick={() => (birthday ? onPerson(id) : onCouple(id))}
      className={`flex cursor-pointer scroll-mt-10 items-center gap-3 border-b border-zinc-100 px-3 py-2.5 md:px-4 dark:border-zinc-800/70 ${
        selected ? "bg-amber-50 max-md:scroll-mb-[56dvh] dark:bg-amber-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      }`}
    >
      <div className="w-24 shrink-0 text-sm">
        <p className="font-medium">{formatDay(event.date)}</p>
        {event.inDays < 31 && <p className={`text-xs ${event.inDays === 0 ? "font-semibold text-amber-700 dark:text-amber-400" : muted}`}>{formatInDays(event.inDays)}</p>}
      </div>
      {birthday ? (
        <PersonPhoto person={event.person} size={40} lazy />
      ) : (
        <div className="flex shrink-0">
          <PersonPhoto person={event.partners[0]} size={40} lazy />
          <div className="-ml-3 rounded-full ring-2 ring-white dark:ring-zinc-900">
            <PersonPhoto person={event.partners[1]} size={40} lazy />
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <button type="button" aria-label={label} className="text-left font-medium">
          {birthday ? event.person.name : `${event.partners[0].name} & ${event.partners[1].name}`}
        </button>
        <p className={`text-xs ${muted}`}>{birthday ? (event.age === undefined ? "Birthday" : `Turns ${event.age}`) : event.years === undefined ? "Anniversary" : `${ordinal(event.years)} anniversary`}</p>
      </div>
      {event.milestone && (
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{event.milestone}</span>
      )}
    </li>
  );
}
