"use client";

import { useEffect, useMemo, useRef } from "react";
import { filterRows, LIST_FILTERS, LIST_SORTS, marriageLines, relationSummary, sortRows, type ListFilter, type ListRow, type ListSort } from "@/tree/everyone";
import { formatDate, formatLife, formatYears } from "@/tree/years";
import { button } from "../ui/button";
import { compactField } from "../ui/field";
import { PersonPhoto } from "./PersonPhoto";

const muted = "text-zinc-500 dark:text-zinc-400";
const none = <span className="text-zinc-400 dark:text-zinc-500">–</span>;

/**
 * ★ Everyone's List (part 2 of an owner request after the final check): everyone with their relations
 * and the sheets that show them, narrowed by a filter and what was typed in Find someone. One table
 * that fits its own width (container queries, so the panel beside it counts): all six columns when
 * wide, then without the sheets, then (phones) only the person, with their dates and relations in a
 * line. Born and Married (owner requests) hold the full birth and marriage dates, and sort the list by them.
 */
export function EveryoneList({
  rows,
  filter,
  query,
  sort,
  selectedId,
  onFilter,
  onSort,
  onShowAll,
  onPerson,
  onOpenSheet,
}: {
  rows: ListRow[];
  filter: ListFilter;
  query: string;
  sort: ListSort;
  selectedId?: string;
  onFilter: (filter: ListFilter) => void;
  onSort: (sort: ListSort) => void;
  /** Back to everyone, with nothing typed. */
  onShowAll: () => void;
  onPerson: (personId: string) => void;
  onOpenSheet: (sheetId: string, personId: string) => void;
}) {
  const shown = useMemo(() => sortRows(filterRows(rows, filter, query), sort), [rows, filter, query, sort]);
  // A date column's name goes round: oldest (or earliest) first, youngest (or latest) first, back to A to Z.
  const byBirth = sort === "oldest" || sort === "youngest";
  const byMarriage = sort === "marriedEarliest" || sort === "marriedLatest";
  const nextBirthSort: ListSort = sort === "oldest" ? "youngest" : sort === "youngest" ? "name" : "oldest";
  const nextMarriageSort: ListSort = sort === "marriedEarliest" ? "marriedLatest" : sort === "marriedLatest" ? "name" : "marriedEarliest";
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
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 pr-3 md:pr-4 dark:border-zinc-800">
        <div role="group" aria-label="Show" className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-3 py-2 scrollbar-none md:px-4">
          {LIST_FILTERS.map((f, i) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => onFilter(f.id)}
              className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-medium whitespace-nowrap text-zinc-700 transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/70 aria-pressed:border-zinc-900 aria-pressed:bg-zinc-900 aria-pressed:text-white pointer-coarse:min-h-11 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:border-white dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900"
            >
              {f.label} ({counts[i]})
            </button>
          ))}
        </div>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(event) => onSort(event.target.value as ListSort)}
          className={`${compactField} shrink-0`}
        >
          {LIST_SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div ref={scroller} className="@container min-h-0 flex-1 overflow-y-auto">
        {shown.length > 0 ? (
          // Fixed layout: a long line under a name is cut short (…) instead of widening the table.
          <table aria-label="People" className="w-full table-fixed text-left text-sm">
            <thead className={`sticky top-0 z-10 hidden bg-white text-[11px] tracking-wide uppercase @2xl:table-header-group dark:bg-zinc-900 ${muted}`}>
              <tr className="shadow-[inset_0_-1px_0] shadow-zinc-200 dark:shadow-zinc-800">
                <th scope="col" className="w-[22%] py-2 pl-4 pr-3 font-medium">Person</th>
                <th scope="col" aria-sort={!byBirth ? "none" : sort === "oldest" ? "ascending" : "descending"} className="w-[12%] px-3 py-2 font-medium">
                  <button type="button" onClick={() => onSort(nextBirthSort)} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
                    Born
                    <span aria-hidden>{!byBirth ? "↕" : sort === "oldest" ? "↑" : "↓"}</span>
                  </button>
                </th>
                <th scope="col" aria-sort={!byMarriage ? "none" : sort === "marriedEarliest" ? "ascending" : "descending"} className="w-[12%] px-3 py-2 font-medium">
                  <button type="button" onClick={() => onSort(nextMarriageSort)} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
                    Married
                    <span aria-hidden>{!byMarriage ? "↕" : sort === "marriedEarliest" ? "↑" : "↓"}</span>
                  </button>
                </th>
                <th scope="col" className="px-3 py-2 font-medium">Parents</th>
                <th scope="col" className="px-3 py-2 font-medium">Partners</th>
                <th scope="col" className="px-3 py-2 font-medium">Children</th>
                <th scope="col" className="hidden w-[18%] px-3 py-2 font-medium @4xl:table-cell">On sheets</th>
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
            <button type="button" onClick={onShowAll} className={button("secondary", "sm")}>
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
  const life = formatLife(person); // full dates where known, for narrow screens without the Born column
  const [born, died] = [formatDate(person.birthYear, person.birthMonth, person.birthDay), formatDate(person.deathYear, person.deathMonth, person.deathDay)];
  const summary = relationSummary(row);
  const married = marriageLines(row);
  return (
    // The whole row chooses the person; the name is its button for keyboards and screen readers (the
    // button's click reaches the row). The scroll margins keep a chosen row clear of the sticky column
    // names and of a phone's panel, and a little off the bottom edge (scrolling stops on whole pixels).
    <tr
      data-person-id={person.id}
      aria-current={selected || undefined}
      onClick={() => onPerson(person.id)}
      className={`cursor-pointer scroll-mt-10 scroll-mb-2 border-b border-zinc-100 align-top dark:border-zinc-800/70 ${
        selected ? "bg-amber-50 max-md:scroll-mb-[56dvh] dark:bg-amber-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      }`}
    >
      <td className="py-2 pl-3 pr-3 md:pl-4">
        <div className="flex items-center gap-3">
          <PersonPhoto person={person} size={40} lazy />
          <div className="min-w-0">
            <button type="button" aria-label={years ? `${person.name}, ${years}` : person.name} className="text-left">
              <span className="font-medium">{person.name}</span>
              {years && <span className={`hidden text-xs @2xl:block ${muted}`}>{years}</span>}
              {life && <span className={`ml-1.5 text-xs @2xl:hidden ${muted}`}>{life}</span>}
            </button>
            {summary.length > 0 && <p className={`truncate text-xs @2xl:hidden ${muted}`}>{summary.join(" · ")}</p>}
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 @2xl:table-cell">
        {born || none}
        {died && <span className={`block text-xs ${muted}`}>Died {died}</span>}
      </td>
      <td className="hidden px-3 py-3 @2xl:table-cell">
        {married.length
          ? married.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))
          : none}
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
