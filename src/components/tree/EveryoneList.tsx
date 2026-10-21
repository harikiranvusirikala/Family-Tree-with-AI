"use client";

import { useEffect, useMemo, useRef } from "react";
import { filterRows, LIST_FILTERS, relationSummary, type ListFilter, type ListRow } from "@/tree/everyone";
import { formatYears } from "@/tree/years";
import { PersonPhoto } from "./PersonPhoto";

const muted = "text-zinc-500 dark:text-zinc-400";
const none = <span className="text-zinc-400 dark:text-zinc-500">–</span>;

/**
 * ★ Everyone's List (part 2 of an owner request after the final check): everyone with their relations
 * and the sheets that show them, narrowed by a filter and what was typed in Find someone. One table
 * that fits its own width (container queries, so the panel beside it counts): all five columns when
 * wide, then without the sheets, then (phones) only the person, with their relations in one line.
 */
export function EveryoneList({
  rows,
  filter,
  query,
  selectedId,
  onFilter,
  onShowAll,
  onPerson,
  onOpenSheet,
}: {
  rows: ListRow[];
  filter: ListFilter;
  query: string;
  selectedId?: string;
  onFilter: (filter: ListFilter) => void;
  /** Back to everyone, with nothing typed. */
  onShowAll: () => void;
  onPerson: (personId: string) => void;
  onOpenSheet: (sheetId: string, personId: string) => void;
}) {
  const shown = useMemo(() => filterRows(rows, filter, query), [rows, filter, query]);
  const counts = useMemo(() => LIST_FILTERS.map((f) => filterRows(rows, f.id).length), [rows]);
  const scroller = useRef<HTMLDivElement>(null);

  // Someone chosen elsewhere (Find in list, a link in the panel, the Tree before switching): bring their
  // row into view. A row already on screen stays put.
  useEffect(() => {
    if (!selectedId) return;
    scroller.current?.querySelector(`[data-person-id="${selectedId}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div role="group" aria-label="Show" className="flex shrink-0 gap-2 overflow-x-auto border-b border-zinc-200 px-3 py-2 scrollbar-none md:px-4 dark:border-zinc-800">
        {LIST_FILTERS.map((f, i) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => onFilter(f.id)}
            className="shrink-0 whitespace-nowrap rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 aria-pressed:border-zinc-900 aria-pressed:bg-zinc-900 aria-pressed:text-white pointer-coarse:min-h-11 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-pressed:border-white dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900"
          >
            {f.label} ({counts[i]})
          </button>
        ))}
      </div>
      <div ref={scroller} className="@container min-h-0 flex-1 overflow-y-auto">
        {shown.length > 0 ? (
          // Fixed layout: a long line under a name is cut short (…) instead of widening the table.
          <table aria-label="People" className="w-full table-fixed text-left text-sm">
            <thead className={`sticky top-0 z-10 hidden bg-white text-xs @2xl:table-header-group dark:bg-zinc-900 ${muted}`}>
              <tr className="shadow-[inset_0_-1px_0] shadow-zinc-200 dark:shadow-zinc-800">
                <th scope="col" className="w-[26%] py-2 pl-4 pr-3 font-medium">Person</th>
                <th scope="col" className="px-3 py-2 font-medium">Parents</th>
                <th scope="col" className="px-3 py-2 font-medium">Partners</th>
                <th scope="col" className="px-3 py-2 font-medium">Children</th>
                <th scope="col" className="hidden w-[22%] px-3 py-2 font-medium @4xl:table-cell">On sheets</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <Row key={row.person.id} row={row} selected={row.person.id === selectedId} onPerson={onPerson} onOpenSheet={onOpenSheet} />
              ))}
            </tbody>
          </table>
        ) : (
          <div className={`flex flex-col items-start gap-2 p-4 text-sm ${muted}`}>
            <p>Nobody matches.</p>
            <button type="button" onClick={onShowAll} className="rounded-full border border-zinc-300 px-3 py-1 font-medium text-zinc-900 hover:bg-zinc-100 pointer-coarse:min-h-11 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
              Show everyone
            </button>
          </div>
        )}
        {/* Room to scroll the last rows above a phone's panel, or clear of the round Ask AI button. */}
        <div aria-hidden className={selectedId ? "h-[55dvh] md:h-24 lg:h-0" : "h-24 lg:h-0"} />
      </div>
    </div>
  );
}

function Row({
  row,
  selected,
  onPerson,
  onOpenSheet,
}: {
  row: ListRow;
  selected: boolean;
  onPerson: (personId: string) => void;
  onOpenSheet: (sheetId: string, personId: string) => void;
}) {
  const { person } = row;
  const years = formatYears(person.birthYear, person.deathYear);
  const summary = relationSummary(row);
  return (
    // The whole row chooses the person; the name is its button for keyboards and screen readers (the
    // button's click reaches the row). The scroll margins keep a chosen row clear of the sticky column
    // names and of a phone's panel.
    <tr
      data-person-id={person.id}
      aria-current={selected || undefined}
      onClick={() => onPerson(person.id)}
      className={`cursor-pointer scroll-mt-10 border-b border-zinc-100 align-top dark:border-zinc-800/70 ${
        selected ? "bg-amber-50 max-md:scroll-mb-[56dvh] dark:bg-amber-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      }`}
    >
      <td className="py-2 pl-3 pr-3 md:pl-4">
        <div className="flex items-center gap-3">
          <PersonPhoto person={person} size={40} lazy />
          <div className="min-w-0">
            <button type="button" aria-label={years ? `${person.name}, ${years}` : person.name} className="text-left">
              <span className="font-medium">{person.name}</span>
              {years && <span className={`ml-1.5 text-xs @2xl:ml-0 @2xl:block ${muted}`}>{years}</span>}
            </button>
            {summary.length > 0 && <p className={`truncate text-xs @2xl:hidden ${muted}`}>{summary.join(" · ")}</p>}
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 @2xl:table-cell">{row.parents.length ? row.parents.map((p) => p.name).join(", ") : none}</td>
      <td className="hidden px-3 py-3 @2xl:table-cell">
        {row.partners.length ? row.partners.map((p) => `${p.person.name}${p.divorced ? " (divorced)" : ""}`).join(", ") : none}
      </td>
      <td className="hidden px-3 py-3 @2xl:table-cell">
        {row.children.length ? `${row.children.length} · ${row.children.map((p) => p.name).join(", ")}` : none}
      </td>
      <td className="hidden px-3 py-2.5 @4xl:table-cell">
        {row.sheets.length ? (
          <div className="flex flex-wrap gap-1">
            {row.sheets.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation(); // the row would choose the person again
                  onOpenSheet(sheet.id, person.id);
                }}
                className="whitespace-nowrap rounded-full border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 pointer-coarse:min-h-11 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {sheet.title}
              </button>
            ))}
          </div>
        ) : (
          none
        )}
      </td>
    </tr>
  );
}
