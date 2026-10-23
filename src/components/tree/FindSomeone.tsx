"use client";

import { useId, useMemo, useState } from "react";
import { findPeople } from "@/tree/everyone";
import type { Person } from "@/tree/types";
import { searchField, searchIcon } from "../ui/field";
import { LineIcon } from "../ui/icons";
import { nameWithYears } from "./edit/PersonPanel";

/**
 * Find someone (★ Everyone, an owner request after the final check): type part of a name, then pick a
 * match with a tap or Up, Down and Enter. `onChoose` gets the person; the box empties for the next search.
 */
export function FindSomeone({ persons, onChoose }: { persons: Person[]; onChoose: (personId: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => findPeople(persons, query), [persons, query]);
  const list = useId();
  const showing = open && query.trim() !== "";

  const choose = (person: Person) => {
    onChoose(person.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <input
        role="combobox"
        aria-label="Find someone"
        aria-autocomplete="list"
        aria-expanded={showing && matches.length > 0}
        aria-controls={list}
        aria-activedescendant={showing && matches[active] ? `${list}-${active}` : undefined}
        placeholder="Find someone…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") setActive((i) => Math.min(i + 1, matches.length - 1));
          else if (event.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
          else if (event.key === "Enter" && matches[active]) choose(matches[active]);
          else if (event.key === "Escape") return open ? setOpen(false) : setQuery("");
          else return;
          event.preventDefault();
        }}
        className={searchField}
      />
      <LineIcon name="search" className={searchIcon} />
      {showing && (
        <div className="absolute right-0 z-30 mt-2 w-full animate-menu-in overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5 text-sm text-zinc-900 shadow-xl shadow-zinc-900/10 motion-reduce:animate-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-black/50">
          {matches.length ? (
            <ul id={list} role="listbox" aria-label="People found">
              {matches.map((person, i) => (
                <li
                  key={person.id}
                  id={`${list}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // Before the box loses focus, which would close the list first.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    choose(person);
                  }}
                  onPointerEnter={() => setActive(i)}
                  className="cursor-pointer rounded-lg px-2.5 py-2 aria-selected:bg-zinc-100 pointer-coarse:py-3 dark:aria-selected:bg-zinc-800"
                >
                  {nameWithYears(person)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2.5 py-2 text-zinc-500 dark:text-zinc-400">Nobody by that name.</p>
          )}
        </div>
      )}
    </div>
  );
}
